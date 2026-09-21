/**
 * Experience score (Blueprint Bagian 08) — fungsi MURNI (tanpa Prisma),
 * konsisten dengan pemisahan tanggung jawab score.ts: pemanggil (team/page.tsx)
 * yang query database, fungsi ini cuma menghitung dari data yang sudah
 * diambil. TODO lama di matching/score.ts sekarang terisi untuk 2 dari 3
 * komponen rumus asli:
 *
 *   0.5·on_time_rate + 0.3·peer_rating_norm + 0.2·projects_completed_norm
 *
 * peer_rating_norm SEKARANG TERISI (4 September 2026) lewat fitur peer
 * rating — lihat computePeerRatingNorm() di bawah. Sebelumnya konstanta
 * netral permanen karena fiturnya memang belum ada. Ketiga komponen rumus
 * Blueprint kini hidup dari data sungguhan.
 */
export const PEER_RATING_NEUTRAL = 0.5;

/**
 * Minimal jumlah PENILAI BERBEDA sebelum peer rating ikut menghitung.
 *
 * Ini pagar anti-gaming, bukan angka sembarangan: tanpa ambang, satu orang
 * bisa menjatuhkan atau mengangkat rekannya sendirian — persis bentuk
 * manipulasi yang dilarang Blueprint Bagian 08. Di bawah ambang, skornya
 * netral (0.5), sama seperti perlakuan cold start: tidak dihukum, tidak
 * diuntungkan.
 *
 * KONSEKUENSI YANG DISENGAJA: di tim beranggota 3 orang, tiap orang hanya
 * bisa dinilai 2 rekannya — jadi satu proyek saja TIDAK cukup mencapai
 * ambang. Itu bukan cacat: ambangnya menghitung penilai berbeda LINTAS
 * PROYEK (lihat query di team/page.tsx), sehingga reputasi baru aktif
 * setelah seseorang benar-benar bekerja dengan 3 orang berbeda. Menuntut
 * keluasan seperti ini justru inti dari "reputasi berbasis bukti" — satu
 * lingkaran pertemanan kecil tidak bisa saling mengangkat.
 *
 * Kalau angka ini diturunkan ke 2, tim 3 orang bisa aktif dalam satu
 * proyek, tapi dua orang yang bersekongkol sudah cukup untuk menggerakkan
 * skor. Itu trade-off yang ditolak.
 */
export const MIN_PEER_RATERS = 3;

/** Skala penilaian per dimensi: 1..5 */
export const PEER_RATING_MIN = 1;
export const PEER_RATING_MAX = 5;

export type PeerRatingInput = {
  raterId: string;
  timeliness: number;
  quality: number;
  communication: number;
};

/**
 * peer_rating_norm 0..1 dari seluruh penilaian yang DITERIMA seseorang
 * (lintas proyek). Tiga dimensi dirata-rata dengan bobot sama — Blueprint
 * tidak menetapkan bobot antar dimensi, jadi jangan mengarang pembobotan
 * yang terkesan presisi padahal tidak ada dasarnya.
 *
 * Penilaian ganda dari orang yang sama untuk proyek berbeda tetap dihitung
 * (dia memang bekerja bersama berkali-kali), tapi AMBANG anti-gaming
 * menghitung penilai BERBEDA — supaya satu orang tidak bisa mengangkat
 * seseorang sendirian hanya dengan menilai di banyak proyek.
 */
export function computePeerRatingNorm(ratings: PeerRatingInput[]): number {
  const distinctRaters = new Set(ratings.map((r) => r.raterId)).size;
  if (distinctRaters < MIN_PEER_RATERS) return PEER_RATING_NEUTRAL;

  const total = ratings.reduce(
    (sum, r) => sum + (r.timeliness + r.quality + r.communication) / 3,
    0,
  );
  const mean = total / ratings.length;
  // 1..5 -> 0..1. Perhatikan: nilai terendah (1) memetakan ke 0, bukan 0.2.
  const norm = (mean - PEER_RATING_MIN) / (PEER_RATING_MAX - PEER_RATING_MIN);
  return Math.min(1, Math.max(0, norm));
}
// 5 proyek selesai di Tether = skor penuh untuk komponen ini. Angka ini
// tidak eksplisit di Blueprint (cuma bilang "projects_completed_norm"),
// dipilih supaya masuk akal untuk populasi mahasiswa (bukan freelancer
// dengan ratusan proyek) — sesuaikan kalau ada data pemakaian nyata.
const COMPLETED_PROJECTS_CAP = 5;

export function computeExperience(input: {
  completedProjectsCount: number;
  completedMilestonesOnTime: number;
  completedMilestonesTotal: number;
  /** Hasil computePeerRatingNorm(). Dihilangkan -> netral (0.5), yaitu
   *  perilaku lama sebelum fitur peer rating ada. */
  peerRatingNorm?: number;
}): number | undefined {
  // Belum pernah menyelesaikan proyek sama sekali -> tidak ada riwayat
  // untuk dihitung. Return undefined (bukan 0!) supaya cold-start default
  // netral (0.5) di matching/score.ts yang berlaku — persis prinsip
  // Blueprint Bagian 08 "tidak dihukum, tidak diuntungkan".
  if (input.completedProjectsCount === 0) return undefined;

  const onTimeRate =
    input.completedMilestonesTotal > 0
      ? input.completedMilestonesOnTime / input.completedMilestonesTotal
      : 0.5; // sudah pernah selesaikan proyek tapi tidak pernah pegang milestone -> netral untuk komponen ini saja

  const projectsCompletedNorm = Math.min(1, input.completedProjectsCount / COMPLETED_PROJECTS_CAP);

  const peerRatingNorm = input.peerRatingNorm ?? PEER_RATING_NEUTRAL;

  return 0.5 * onTimeRate + 0.3 * peerRatingNorm + 0.2 * projectsCompletedNorm;
}
