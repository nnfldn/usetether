"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, limitFromEnv } from "@/lib/rate-limit";
import { MAX_ACTIVE_PROJECTS } from "@/lib/validations/project";
import { notify } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import { noticeUrl } from "@/lib/action-notice";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return user.id;
}

// Alur dua arah (keputusan #2 Lampiran C): owner mengundang ATAU kandidat
// melamar — kedua fungsi di bawah cuma MEMBUAT permintaan berstatus PENDING.
// Keanggotaan baru sah HANYA lewat respondInvitationAction (keputusan #3:
// tidak ada penambahan otomatis ke TeamMember tanpa persetujuan eksplisit
// pihak lain).
export async function inviteCandidateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const projectId = String(formData.get("projectId"));
  const candidateId = String(formData.get("candidateId"));

  const teamPath = `/projects/${projectId}/team`;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  // Hanya owner yang boleh mengundang — diperiksa di lapisan logika, bukan
  // cuma disembunyikan di UI (checklist keamanan "otorisasi tingkat objek").
  if (!project || project.ownerId !== userId) redirect(noticeUrl(teamPath, "INVITE_NOT_OWNER"));

  // Rate limit undangan (checklist keamanan Bagian 09) — cegah owner
  // (atau akun yang diretas) mengundang massal sebagai spam. Dikunci per
  // userId, bukan IP, karena aksi ini sudah butuh sesi login.
  if (!checkRateLimit(`invite:${userId}`, limitFromEnv("RATE_LIMIT_INVITE", 30), 60 * 60 * 1000)) {
    redirect(noticeUrl(teamPath, "INVITE_RATE_LIMIT"));
  }

  const existing = await prisma.teamInvitation.findFirst({
    where: { projectId, profileId: candidateId, status: "PENDING" },
  });
  if (existing) redirect(noticeUrl(teamPath, "INVITE_DUP"));

  await prisma.teamInvitation.create({
    data: { projectId, profileId: candidateId, direction: "OWNER_INVITED", status: "PENDING" },
  });
  await notify(candidateId, "INVITATION", `Kamu diundang bergabung ke proyek "${project.title}".`, projectId);

  revalidatePath(`/projects/${projectId}/team`);
}

export async function applyCandidateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const projectId = String(formData.get("projectId"));
  const overviewPath = `/projects/${projectId}`;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) redirect(noticeUrl(overviewPath, "PROJECT_NOT_FOUND"));
  // Owner tidak melamar ke proyeknya sendiri; anggota aktif tidak melamar lagi.
  if (project.ownerId === userId) redirect(noticeUrl(overviewPath, "APPLY_IS_OWNER"));
  const alreadyMember = await prisma.teamMember.findFirst({
    where: { team: { projectId }, profileId: userId, status: "ACTIVE" },
  });
  if (alreadyMember) redirect(noticeUrl(overviewPath, "APPLY_ALREADY_MEMBER"));

  // Rate limit lamaran — cegah satu akun spam melamar ke banyak proyek
  // sekaligus dalam waktu singkat.
  if (!checkRateLimit(`apply:${userId}`, limitFromEnv("RATE_LIMIT_APPLY", 30), 60 * 60 * 1000)) {
    redirect(noticeUrl(overviewPath, "APPLY_RATE_LIMIT"));
  }

  const existing = await prisma.teamInvitation.findFirst({
    where: { projectId, profileId: userId, status: "PENDING" },
  });
  if (existing) redirect(noticeUrl(overviewPath, "APPLY_DUP"));

  await prisma.teamInvitation.create({
    data: { projectId, profileId: userId, direction: "CANDIDATE_APPLIED", status: "PENDING" },
  });
  const applicant = await prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true } });
  await notify(
    project.ownerId,
    "INVITATION",
    `${applicant?.fullName ?? "Seseorang"} melamar bergabung ke proyek "${project.title}".`,
    projectId,
  );

  revalidatePath(`/projects/${projectId}`);
}

const DECISIONS = ["ACCEPTED", "DECLINED"] as const;

// Pihak yang BERHAK merespons adalah pihak yang TIDAK memulai permintaan:
// owner mengundang -> kandidat yang merespons; kandidat melamar -> owner yang
// merespons. Diterima -> TeamMember dibuat di sini (satu-satunya jalur
// penambahan anggota tim di seluruh aplikasi).
export async function respondInvitationAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const invitationId = String(formData.get("invitationId"));
  const decision = String(formData.get("decision"));
  // Dikirim oleh kedua halaman yang memasang form ini ([id]/page.tsx dan
  // team/page.tsx) supaya redirect penolakan kembali ke halaman asal, bukan
  // ditebak dari projectId (invitation belum tentu berhasil diambil kalau
  // langsung redirect ke situ).
  const rawRedirect = String(formData.get("redirectTo") || "/projects");
  // Validasi: cegah open redirect — hanya izinkan path relatif internal
  const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/projects";
  if (!DECISIONS.includes(decision as (typeof DECISIONS)[number])) {
    redirect(noticeUrl(redirectTo, "INVITATION_INVALID"));
  }

  const invitation = await prisma.teamInvitation.findUnique({
    where: { id: invitationId },
    include: { project: true },
  });
  if (!invitation || invitation.status !== "PENDING") {
    redirect(noticeUrl(redirectTo, "INVITATION_GONE"));
  }

  const isAuthorized =
    invitation.direction === "OWNER_INVITED"
      ? invitation.profileId === userId
      : invitation.project.ownerId === userId;
  if (!isAuthorized) redirect(noticeUrl(redirectTo, "INVITATION_NOT_AUTHORIZED"));

  // Keputusan #4 Lampiran C: batas wajar proyek aktif — dicek di titik
  // keanggotaan BENAR-BENAR terbentuk (bukan saat melamar/mengundang),
  // karena baru di sinilah komitmennya jadi nyata. `invitation.profileId`
  // adalah orang yang AKAN jadi anggota, bukan selalu `userId` yang
  // merespons (owner bisa merespons lamaran orang lain).
  if (decision === "ACCEPTED") {
    const activeMemberships = await prisma.teamMember.count({
      where: { profileId: invitation.profileId, status: "ACTIVE" },
    });
    if (activeMemberships >= MAX_ACTIVE_PROJECTS) {
      redirect(noticeUrl(redirectTo, "INVITATION_AT_LIMIT"));
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamInvitation.update({
      where: { id: invitationId },
      data: { status: decision as (typeof DECISIONS)[number], respondedAt: new Date() },
    });

    if (decision === "ACCEPTED") {
      const team = await tx.team.upsert({
        where: { projectId: invitation.projectId },
        create: { projectId: invitation.projectId },
        update: {},
      });
      await tx.teamMember.upsert({
        where: { teamId_profileId: { teamId: team.id, profileId: invitation.profileId } },
        create: { teamId: team.id, profileId: invitation.profileId, role: "Member" },
        update: { status: "ACTIVE", leftAt: null },
      });
    }
  });

  // Audit log (checklist keamanan Bagian 09) — actorId = yang MERESPONS
  // (bisa beda dari targetProfileId kalau owner yang menyetujui lamaran
  // orang lain), bukan cuma siapa yang jadi anggota.
  if (decision === "ACCEPTED") {
    await logAudit({
      projectId: invitation.projectId,
      actorId: userId,
      targetProfileId: invitation.profileId,
      action: "TEAM_MEMBER_JOINED",
    });
  }

  // Notifikasi ke pihak yang TIDAK merespons (bukan ke diri sendiri).
  const decisionText = decision === "ACCEPTED" ? "menerima" : "menolak";
  if (invitation.direction === "OWNER_INVITED") {
    // Kandidat yang merespons -> beri tahu owner.
    const candidate = await prisma.profile.findUnique({ where: { id: invitation.profileId }, select: { fullName: true } });
    await notify(
      invitation.project.ownerId,
      "INVITATION",
      `${candidate?.fullName ?? "Kandidat"} ${decisionText} undangan ke proyek "${invitation.project.title}".`,
      invitation.projectId,
    );
  } else {
    // Owner yang merespons lamaran -> beri tahu kandidat.
    await notify(
      invitation.profileId,
      "INVITATION",
      `Lamaranmu ke proyek "${invitation.project.title}" ${decisionText === "menerima" ? "diterima" : "ditolak"}.`,
      invitation.projectId,
    );
  }

  revalidatePath(`/projects/${invitation.projectId}`);
  revalidatePath(`/projects/${invitation.projectId}/team`);
  revalidatePath("/profile");
}

const ENDORSEMENT_LEVEL = 0.8;

// Jenjang bukti 0.80 (Blueprint Bagian 08): endorsement dari REKAN SATU TIM
// — dicek di sini lewat projectId yang dikirim form (endorser & yang
// diendorse harus sama-sama anggota aktif proyek YANG SAMA saat endorsement
// dilakukan), bukan cuma "user mana pun boleh endorse siapa pun". Ini
// otorisasi tingkat objek yang sesungguhnya menegakkan makna "rekan".
export async function endorseSkillAction(formData: FormData): Promise<void> {
  const endorserId = await requireUserId();
  const projectId = String(formData.get("projectId"));
  const profileSkillId = String(formData.get("profileSkillId"));
  const teamPath = `/projects/${projectId}/team`;

  const profileSkill = await prisma.profileSkill.findUnique({ where: { id: profileSkillId } });
  if (!profileSkill) redirect(noticeUrl(teamPath, "SKILL_NOT_FOUND"));
  if (profileSkill.profileId === endorserId) redirect(noticeUrl(teamPath, "ENDORSE_SELF")); // tidak bisa endorse diri sendiri

  const [endorserIsMember, endorseeIsMember] = await Promise.all([
    prisma.teamMember.findFirst({
      where: { team: { projectId }, profileId: endorserId, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.teamMember.findFirst({
      where: { team: { projectId }, profileId: profileSkill.profileId, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);
  if (!endorserIsMember || !endorseeIsMember) redirect(noticeUrl(teamPath, "ENDORSE_NOT_MEMBER"));

  await prisma.$transaction(async (tx) => {
    // Unique constraint (profileSkillId, endorserId) mencegah endorsement
    // ganda dari orang yang sama — kalau sudah ada, upsert ini no-op aman.
    await tx.skillEndorsement.upsert({
      where: { profileSkillId_endorserId: { profileSkillId, endorserId } },
      create: { profileSkillId, endorserId },
      update: {},
    });
    // Math.max — endorsement TIDAK PERNAH menurunkan level yang sudah lebih
    // tinggi (mis. skill yang sudah 1.00 dari proyek selesai sebelumnya).
    await tx.profileSkill.update({
      where: { id: profileSkillId },
      data: { evidenceLevel: Math.max(profileSkill.evidenceLevel, ENDORSEMENT_LEVEL) },
    });
  });

  revalidatePath(`/projects/${projectId}/team`);
}

// Sebelumnya TIDAK ADA cara sama sekali untuk keluar dari proyek yang
// sudah diikuti — ditemukan saat membangun audit log (Bagian 09) dan
// dibangun sekalian, karena audit log "perubahan keanggotaan" tidak
// berarti apa-apa kalau cuma bisa mencatat sisi masuknya saja.
export async function leaveProjectAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const projectId = String(formData.get("projectId"));
  const teamPath = `/projects/${projectId}/team`;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) redirect(noticeUrl(teamPath, "PROJECT_NOT_FOUND"));
  // Owner TIDAK BISA keluar lewat sini — tidak ada fitur transfer
  // kepemilikan proyek, jadi owner keluar berarti proyek jadi yatim.
  // Kalau owner memang mau berhenti, jalurnya adalah menutup proyek
  // (completeProjectAction), bukan meninggalkannya.
  if (project.ownerId === userId) redirect(noticeUrl(teamPath, "LEAVE_IS_OWNER"));

  const member = await prisma.teamMember.findFirst({
    where: { team: { projectId }, profileId: userId, status: "ACTIVE" },
  });
  if (!member) redirect(noticeUrl(teamPath, "LEAVE_NOT_MEMBER"));

  await prisma.teamMember.update({
    where: { id: member.id },
    data: { status: "LEFT", leftAt: new Date() },
  });

  await logAudit({
    projectId,
    actorId: userId,
    targetProfileId: userId,
    action: "TEAM_MEMBER_LEFT",
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/team`);
  revalidatePath("/profile");
}
