/**
 * Mesin Project Health — Blueprint Bagian 07. Empat indikator + skor
 * gabungan. Fungsi murni (lihat catatan pemisahan tanggung jawab di
 * src/lib/matching/score.ts) — dipanggil oleh cron harian
 * (app/api/cron/health-snapshot, Fase 5) yang menyuplai data Activity dari
 * database, ditulis ke HealthSnapshot.
 */

export type ActivityLike = {
  weight: number;
  createdAt: Date;
  actorId: string;
};

const A_TARGET = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(date: Date, now: Date): number {
  return Math.max(0, (now.getTime() - date.getTime()) / DAY_MS);
}

/**
 * Pulse — aktivitas dengan peluruhan waktu. Peluruhan setengah setiap 3
 * hari: aktivitas kemarin jauh lebih berarti daripada aktivitas minggu
 * lalu, mendeteksi proyek yang sedang mendingin.
 *
 * A = Σ bobot(e) × 0.5^(umur_hari(e)/3) untuk aktivitas 7 hari terakhir
 * Pulse = 100 × min(1, A / A_target)
 */
export function computePulse(activities: ActivityLike[], now = new Date()): number {
  const recent = activities.filter((a) => daysAgo(a.createdAt, now) <= 7);
  const a = recent.reduce(
    (sum, act) => sum + act.weight * Math.pow(0.5, daysAgo(act.createdAt, now) / 3),
    0,
  );
  return 100 * Math.min(1, a / A_TARGET);
}

/**
 * Momentum — perbandingan dua periode 7 hari.
 * Momentum = 50 × (1 + (V_now - V_prev) / max(V_now + V_prev, ε))
 * 50 = datar, >50 = mempercepat, <50 = melambat.
 */
export function computeMomentum(activities: ActivityLike[], now = new Date()): number {
  const EPSILON = 1e-6;
  let vNow = 0;
  let vPrev = 0;

  for (const a of activities) {
    const age = daysAgo(a.createdAt, now);
    if (age <= 7) vNow += a.weight;
    else if (age <= 14) vPrev += a.weight;
  }

  return 50 * (1 + (vNow - vPrev) / Math.max(vNow + vPrev, EPSILON));
}

/**
 * Balance — koefisien Gini atas kontribusi per anggota.
 * G = ΣᵢΣⱼ |x[i]-x[j]| / (2n² · rata(x))
 * Balance = 100 × (1 - G)
 *
 * Dipilih karena satu angka yang sudah dikenal luas dan tahan terhadap
 * ukuran tim. Peringatan dipicu saat Balance < 60 (lihat computeAlerts).
 */
export function computeBalance(contributionByMember: number[]): number {
  const n = contributionByMember.length;
  if (n === 0) return 100; // tidak ada anggota -> tidak ada ketimpangan untuk diukur

  const mean = contributionByMember.reduce((s, x) => s + x, 0) / n;
  if (mean === 0) return 100; // belum ada kontribusi sama sekali -> belum ada ketimpangan

  let sumAbsDiff = 0;
  for (const xi of contributionByMember) {
    for (const xj of contributionByMember) {
      sumAbsDiff += Math.abs(xi - xj);
    }
  }
  const gini = sumAbsDiff / (2 * n * n * mean);
  return 100 * (1 - gini);
}

/**
 * Forecast — kecepatan aktual vs kecepatan yang dibutuhkan.
 * V_req = sisa bobot pekerjaan / sisa hari sampai deadline
 * V_act = rata-rata bergerak eksponensial (EMA) bobot selesai per hari
 * ρ = V_act / V_req
 * Forecast = 100 × min(1, 2ρ/(ρ+1))   (ρ=1 -> 100, ρ=0.5 -> 67)
 *
 * `dailyCompletedWeights` = larik bobot selesai per hari, terurut dari
 * paling lama ke paling baru (dipakai untuk EMA). Konstanta smoothing EMA
 * (alpha=0.3) TIDAK ditulis eksplisit di Blueprint — dipilih sebagai nilai
 * wajar (jendela efektif ±6 hari), boleh disesuaikan tim kalau perlu.
 */
const EMA_ALPHA = 0.3;

export function computeForecast(
  remainingWeight: number,
  daysUntilDeadline: number,
  dailyCompletedWeights: number[],
): number {
  if (daysUntilDeadline <= 0) {
    // Sudah lewat tenggat: kalau masih ada sisa pekerjaan, forecast minimum;
    // kalau tidak ada sisa, dianggap selesai tepat waktu.
    return remainingWeight > 0 ? 0 : 100;
  }
  if (dailyCompletedWeights.length === 0) return 0;

  const vAct = dailyCompletedWeights.reduce(
    (ema, w) => EMA_ALPHA * w + (1 - EMA_ALPHA) * ema,
    dailyCompletedWeights[0],
  );
  const vReq = remainingWeight / daysUntilDeadline;
  if (vReq <= 0) return 100; // tidak ada sisa pekerjaan berbobot -> aman

  const rho = vAct / vReq;
  return 100 * Math.min(1, (2 * rho) / (rho + 1));
}

export type HealthComposite = {
  pulse: number;
  momentum: number;
  balance: number;
  forecast: number;
  composite: number;
  status: "SEHAT" | "PERLU_PERHATIAN" | "BERISIKO" | "KRITIS";
};

/** Skor gabungan = 0.30·Forecast + 0.25·Momentum + 0.25·Pulse + 0.20·Balance */
export function composeHealth(
  pulse: number,
  momentum: number,
  balance: number,
  forecast: number,
): HealthComposite {
  const composite = 0.3 * forecast + 0.25 * momentum + 0.25 * pulse + 0.2 * balance;
  const status =
    composite >= 80
      ? "SEHAT"
      : composite >= 60
        ? "PERLU_PERHATIAN"
        : composite >= 40
          ? "BERISIKO"
          : "KRITIS";
  return { pulse, momentum, balance, forecast, composite, status };
}

// ---------------------------------------------------------------------
// Peringatan dini — Blueprint Bagian 07. Mengubah kondisi terukur jadi
// kalimat yang bisa ditindaklanjuti. `to` menentukan siapa yang berhak
// melihat (Balance HANYA ke owner — etika pemantauan, jangan pernah
// dilonggarkan jadi "seluruh tim").
// ---------------------------------------------------------------------

export type HealthAlert = {
  trigger:
    | "MILESTONE_LATE"
    | "PULSE_DROP"
    | "LOW_BALANCE"
    | "LOW_FORECAST"
    | "DORMANT";
  message: string;
  to: "OWNER_ONLY" | "OWNER_AND_MILESTONE_HOLDER" | "WHOLE_TEAM";
};

export function computeAlerts(input: {
  milestoneDaysLate?: number;
  pulseDropLast7Days?: number;
  balance?: number;
  forecast?: number;
  daysSinceLastActivity?: number;
}): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  if ((input.milestoneDaysLate ?? 0) >= 2) {
    alerts.push({
      trigger: "MILESTONE_LATE",
      message: `Milestone terlambat ${input.milestoneDaysLate} hari.`,
      to: "OWNER_AND_MILESTONE_HOLDER",
    });
  }
  if ((input.pulseDropLast7Days ?? 0) > 30) {
    alerts.push({
      trigger: "PULSE_DROP",
      message: "Aktivitas proyek turun tajam minggu ini.",
      to: "WHOLE_TEAM",
    });
  }
  if (input.balance !== undefined && input.balance < 60) {
    alerts.push({
      trigger: "LOW_BALANCE",
      message:
        "Beban kerja terkonsentrasi pada satu anggota. Pertimbangkan mendistribusikan ulang task terbuka.",
      to: "OWNER_ONLY", // JANGAN diubah ke WHOLE_TEAM — menghukum individu di depan tim
    });
  }
  if (input.forecast !== undefined && input.forecast < 50) {
    alerts.push({
      trigger: "LOW_FORECAST",
      message: "Dengan kecepatan saat ini, proyek berisiko selesai setelah tenggat.",
      to: "WHOLE_TEAM",
    });
  }
  if ((input.daysSinceLastActivity ?? 0) >= 21) {
    alerts.push({
      trigger: "DORMANT",
      message: "Proyek ditandai dorman. Tutup, arsipkan, atau serahkan kepemilikan?",
      to: "OWNER_ONLY",
    });
  }

  return alerts;
}
