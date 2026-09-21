import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computePulse,
  computeMomentum,
  computeBalance,
  computeForecast,
  composeHealth,
  computeAlerts,
  type HealthAlert,
} from "@/lib/health/score";
import { notify } from "@/lib/notify";
import { wibCalendarDate } from "@/lib/date";

// Cron harian (didaftarkan di vercel.json, ROADMAP.md milestone 5.2).
// Dilindungi CRON_SECRET yang otomatis dikirim Vercel Cron sebagai header
// Authorization — endpoint ini menolak permintaan lain.
//
// FUNGSI GANDA: rute ini juga jadi mitigasi gratis anti-pause Supabase
// (proyek free tier di-pause otomatis setelah 7 hari tanpa aktivitas
// database). JANGAN tambahkan kondisi "skip kalau tidak ada proyek aktif"
// — query di bawah harus tetap menyentuh database tiap hari apa pun
// hasilnya.
const FORECAST_HISTORY_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, deadline: true, createdAt: true, ownerId: true, title: true },
  });

  const DORMANT_AFTER_DAYS = 21; // keputusan #10 Lampiran C

  const now = new Date();
  // Tanggal kalender WIB (bukan UTC) — lihat catatan bug di lib/date.ts.
  const today = wibCalendarDate(now);

  // Kasus tepi (audit #7 RENCANA-EKSEKUSI-20-SEP.md): "cron menandai DORMANT
  // di tengah masa penjurian — proyek demo tidak boleh terbalik statusnya
  // sendiri saat sedang dinilai". Proyek demo dibuat akhir Agustus/awal
  // September, jadi ambang 21 hari tanpa aktivitas jatuh tepat di sekitar
  // jadwal penjurian — set DORMANT_FREEZE_UNTIL (tanggal ISO, mis.
  // "2026-09-21") di env sebelum latihan demo/hari-H supaya transisi
  // DORMANT ditunda sampai lewat tanggal itu. TIDAK membekukan seluruh
  // cron — snapshot kesehatan harian (dan mitigasi anti-pause Supabase di
  // atas) tetap jalan seperti biasa, cuma langkah penandaan DORMANT yang
  // ditunda.
  const dormantFreezeUntil = process.env.DORMANT_FREEZE_UNTIL
    ? new Date(process.env.DORMANT_FREEZE_UNTIL)
    : null;
  const dormantFrozen = dormantFreezeUntil != null && now < dormantFreezeUntil;

  let processed = 0;

  for (const { id: projectId, deadline, createdAt, ownerId, title } of projects) {
    // Batch per proyek (bukan per-anggota-per-request) — tetap perlu diawasi
    // kalau jumlah proyek aktif membesar menjelang demo (limit durasi fungsi
    // Vercel Hobby 60 detik, lihat ROADMAP.md gotcha #4/#5).
    const activities = await prisma.activity.findMany({
      where: {
        projectId,
        createdAt: { gte: new Date(now.getTime() - 14 * DAY_MS) },
      },
      select: { weight: true, createdAt: true, actorId: true, eventType: true },
    });

    const pulse = computePulse(activities, now);
    const momentum = computeMomentum(activities, now);

    const byMember = new Map<string, number>();
    for (const a of activities) {
      byMember.set(a.actorId, (byMember.get(a.actorId) ?? 0) + a.weight);
    }
    const balance = computeBalance(Array.from(byMember.values()));

    // Forecast (Blueprint Bagian 07): sisa bobot pekerjaan / sisa hari
    // sampai tenggat, dibandingkan kecepatan penyelesaian aktual (EMA).
    // "Sisa bobot pekerjaan" = total weight Task yang belum DONE milik
    // proyek ini (bukan weight Milestone — itu cuma bobot kepentingan
    // kontainer, unit kerja sesungguhnya ada di Task).
    let forecast = 100; // default netral kalau proyek belum punya tenggat sama sekali
    if (deadline) {
      const daysUntilDeadline = (deadline.getTime() - now.getTime()) / DAY_MS;

      const remainingWeightResult = await prisma.task.aggregate({
        where: { status: { not: "DONE" }, milestone: { projectId } },
        _sum: { weight: true },
      });
      const remainingWeight = remainingWeightResult._sum.weight ?? 0;

      const completionActivities = activities.filter(
        (a) => a.eventType === "TASK_SELESAI" || a.eventType === "MILESTONE_SELESAI",
      );
      const dailyCompletedWeights = bucketByDay(
        completionActivities,
        now,
        FORECAST_HISTORY_DAYS,
      );

      forecast = computeForecast(remainingWeight, daysUntilDeadline, dailyCompletedWeights);
    }

    const health = composeHealth(pulse, momentum, balance, forecast);

    await prisma.healthSnapshot.upsert({
      where: { projectId_snapshotDate: { projectId, snapshotDate: today } },
      create: {
        projectId,
        snapshotDate: today,
        pulse: health.pulse,
        momentum: health.momentum,
        balance: health.balance,
        forecast: health.forecast,
        composite: health.composite,
      },
      update: {
        pulse: health.pulse,
        momentum: health.momentum,
        balance: health.balance,
        forecast: health.forecast,
        composite: health.composite,
      },
    });
    // Keputusan #10 Lampiran C: proyek ditandai dorman otomatis setelah
    // periode sepi — dicek SESUDAH snapshot hari ini tersimpan (histori
    // tetap lengkap), lewat query terpisah (bukan `activities` di atas,
    // yang cuma menampung 14 hari — kurang buat ambang 21 hari). Proyek
    // yang baru dibuat (belum genap 21 hari) TIDAK ditandai dorman
    // prematur meski memang belum sempat ada aktivitas.
    const projectAgeDays = (now.getTime() - createdAt.getTime()) / DAY_MS;
    let becameDormant = false;
    if (!dormantFrozen && projectAgeDays >= DORMANT_AFTER_DAYS) {
      const recentActivity = await prisma.activity.findFirst({
        where: { projectId, createdAt: { gte: new Date(now.getTime() - DORMANT_AFTER_DAYS * DAY_MS) } },
        select: { id: true },
      });
      if (!recentActivity) {
        await prisma.project.update({ where: { id: projectId }, data: { status: "DORMANT" } });
        becameDormant = true;
      }
    }

    // Notifikasi peringatan dini (Notification.HEALTH_ALERT) — pakai
    // computeAlerts yang SAMA dengan yang dirender di halaman ringkasan
    // proyek, supaya notifikasi & tampilan tidak pernah berbeda cerita.
    // Cron jalan sekali/hari, jadi "sekali per hari selama kondisi masih
    // berlangsung" ini cukup sebagai dedup alami — tidak perlu logika
    // dedup terpisah.
    const lateMilestone = becameDormant
      ? null
      : await prisma.milestone.findFirst({
          where: { projectId, status: { not: "DONE" }, deadline: { lt: now } },
          orderBy: { deadline: "asc" },
        });
    const snapshotWeekAgo = await prisma.healthSnapshot.findFirst({
      where: { projectId, snapshotDate: { lte: new Date(now.getTime() - 7 * DAY_MS) } },
      orderBy: { snapshotDate: "desc" },
    });
    const alerts = becameDormant
      ? []
      : computeAlerts({
          milestoneDaysLate: lateMilestone ? Math.floor((now.getTime() - lateMilestone.deadline.getTime()) / DAY_MS) : 0,
          pulseDropLast7Days: snapshotWeekAgo ? Math.max(0, snapshotWeekAgo.pulse - health.pulse) : undefined,
          balance: health.balance,
          forecast: health.forecast,
          // DORMANT ditangani lewat becameDormant di atas, bukan lewat
          // computeAlerts di sini — hindari dua jalur berbeda untuk hal yang
          // sama persis.
        });

    if (becameDormant) {
      await notify(ownerId, "HEALTH_ALERT", `Proyek "${title}" ditandai dorman — tidak ada aktivitas ${DORMANT_AFTER_DAYS}+ hari.`, projectId);
    }
    if (alerts.length > 0) {
      const activeMembers = alerts.some((a: HealthAlert) => a.to === "WHOLE_TEAM")
        ? (await prisma.teamMember.findMany({ where: { team: { projectId }, status: "ACTIVE" }, select: { profileId: true } })).map((m) => m.profileId)
        : [];
      for (const alert of alerts) {
        const recipients =
          alert.to === "WHOLE_TEAM"
            ? activeMembers
            : alert.to === "OWNER_AND_MILESTONE_HOLDER"
              ? Array.from(new Set([ownerId, lateMilestone?.ownerId].filter((v): v is string => Boolean(v))))
              : [ownerId];
        for (const profileId of recipients) {
          await notify(profileId, "HEALTH_ALERT", `[${title}] ${alert.message}`, projectId);
        }
      }
    }

    processed++;
  }

  return NextResponse.json({ processed, ranAt: now.toISOString() });
}

// Larik bobot selesai per hari, terurut dari paling lama ke paling baru —
// bentuk yang dibutuhkan computeForecast untuk EMA (src/lib/health/score.ts).
function bucketByDay(
  activities: { weight: number; createdAt: Date }[],
  now: Date,
  days: number,
): number[] {
  const buckets = new Array(days).fill(0);
  for (const a of activities) {
    const dayIndex = days - 1 - Math.floor((now.getTime() - a.createdAt.getTime()) / DAY_MS);
    if (dayIndex >= 0 && dayIndex < days) buckets[dayIndex] += a.weight;
  }
  return buckets;
}
