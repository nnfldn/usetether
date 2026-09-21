/**
 * Mesin Adaptive Team Formation — Blueprint Bagian 05.
 *
 * Fungsi murni, terisolasi dari database dan UI (prinsip pemisahan tanggung
 * jawab, Rencana Implementasi Bab 6) — bisa diuji tanpa Prisma/Next.js sama
 * sekali, cukup lempar objek biasa. Pemanggil (Server Action/Route Handler
 * di modul Projects) bertanggung jawab mengambil data dari database dan
 * membentuknya jadi tipe di bawah.
 *
 * Kontrak `MatchResult` ini yang harus disepakati Backend<->Frontend di
 * awal Fase 3 (ROADMAP.md milestone 3.1) — jangan diubah bentuknya tanpa
 * dikoordinasikan, karena visualisasi radar kandidat bergantung padanya.
 */

export type SkillLevel = {
  skillId: string;
  /** proficiency 0..1 — untuk kandidat: ProfileSkill.evidenceLevel */
  level: number;
};

export type ProjectRequirement = {
  skillId: string;
  /** r[j]: tingkat kepentingan skill j bagi proyek, 0..1 */
  importance: number;
};

export type TeamSkillCoverage = {
  skillId: string;
  /** t[j]: max proficiency ANGGOTA TIM SAAT INI pada skill j (0 kalau tidak ada anggota yang punya) */
  coverage: number;
};

export type AvailabilitySlot = { dayOfWeek: number; block: string };

export type Candidate = {
  profileId: string;
  skills: SkillLevel[];
  availability: AvailabilitySlot[];
  interests: string[];
  /**
   * Experience 0..1 — undefined = DEFAULT NETRAL 0.5 diterapkan di bawah
   * (Blueprint Bagian 08 "Masalah 3 — Cold Start": tidak dihukum, tidak
   * diuntungkan), dipakai untuk pengguna yang belum pernah menyelesaikan
   * proyek. Untuk yang sudah punya riwayat, dihitung oleh
   * `computeExperience()` (src/lib/matching/experience.ts) dari data
   * TeamMember+Milestone sungguhan — dipanggil oleh pemanggil fungsi ini
   * (team/page.tsx), bukan di sini, supaya score.ts tetap fungsi murni
   * tanpa akses Prisma. peer_rating_norm di rumus itu tetap netral
   * permanen (0.5) karena fitur peer rating belum dibangun sama sekali.
   */
  experience?: number;
};

export type TeamContext = {
  requirements: ProjectRequirement[];
  currentCoverage: TeamSkillCoverage[];
  /**
   * Union slot ketersediaan seluruh anggota tim saat ini — dipakai sebagai
   * penyebut pada rumus Availability. INI ASUMSI, bukan hal yang dikunci
   * eksplisit di Blueprint (rumus aslinya cuma menulis "slot_tim" tanpa
   * merinci cara menurunkannya) — sepakati dengan Product/Naufal sebelum
   * dianggap final, gampang diganti jadi interseksi kalau tim memutuskan
   * beda.
   */
  teamAvailability: AvailabilitySlot[];
  /**
   * skillId -> nama skill, dipakai HANYA untuk menyusun kalimat penjelasan
   * (tidak pernah ikut menghitung skor). Opsional: kalau tidak diberikan,
   * penjelasan jatuh kembali ke nama komponen saja.
   */
  skillNames?: Map<string, string>;
};

export type MatchWeights = {
  gapCoverage: number;
  availability: number;
  complementarity: number;
  interest: number;
  experience: number;
};

/** Bobot default Blueprint Bagian 05. Owner boleh menyesuaikan (keputusan
 *  #6 Lampiran C: "bobot dapat disetel owner"), tapi lewat sanitizeWeights
 *  di bawah — bukan bebas sepenuhnya. */
export const DEFAULT_WEIGHTS: MatchWeights = {
  gapCoverage: 0.35,
  availability: 0.2,
  complementarity: 0.15,
  interest: 0.15,
  experience: 0.15,
};

/**
 * Anti-bias Blueprint Bagian 08 Masalah 4: "bobot Experience dibatasi
 * maksimum 0.15 dan tidak bisa dinaikkan owner". Ditegakkan DI SINI —
 * lapisan logika — bukan cuma di validasi form atau UI, supaya tidak ada
 * jalur apa pun (form dimanipulasi, data lama, panggilan langsung) yang
 * bisa menaikkannya. Bobot juga dinormalisasi agar berjumlah 1 supaya skor
 * tetap sebanding antar proyek meski owner mengubah komposisinya.
 */
export const MAX_EXPERIENCE_WEIGHT = 0.15;

export function sanitizeWeights(input: Partial<MatchWeights> | null | undefined): MatchWeights {
  // Tanpa bobot kustom, kembalikan default APA ADANYA — jangan lewatkan
  // normalisasi, karena pembagian float bikin 0.35 jadi 0.3499999999999999
  // tanpa alasan (tidak salah secara peringkat, tapi bikin angka yang
  // ditampilkan ke owner terlihat aneh).
  if (input == null) return { ...DEFAULT_WEIGHTS };

  const merged = { ...DEFAULT_WEIGHTS, ...input };
  const others = {
    gapCoverage: Math.max(0, merged.gapCoverage),
    availability: Math.max(0, merged.availability),
    complementarity: Math.max(0, merged.complementarity),
    interest: Math.max(0, merged.interest),
  };
  const experienceRaw = Math.max(0, merged.experience);
  const othersTotal =
    others.gapCoverage + others.availability + others.complementarity + others.interest;

  // Semua nol / tidak masuk akal -> balik ke default.
  if (othersTotal + experienceRaw <= 0) return DEFAULT_WEIGHTS;

  // Cap ditegakkan pada bobot AKHIR (setelah normalisasi), bukan pada
  // angka mentah — kalau tidak, {gapCoverage:0.1, experience:0.15} akan
  // dinormalisasi jadi experience 0.6 dan justru melanggar cap yang
  // seharusnya dijaga.
  const experienceShare = Math.min(
    MAX_EXPERIENCE_WEIGHT,
    experienceRaw / (othersTotal + experienceRaw),
  );
  const remaining = 1 - experienceShare;

  // Owner cuma mengisi Experience (empat lainnya nol) -> sisanya dibagi
  // mengikuti proporsi default, bukan dibiarkan nol semua.
  if (othersTotal <= 0) {
    const defaultOthersTotal =
      DEFAULT_WEIGHTS.gapCoverage +
      DEFAULT_WEIGHTS.availability +
      DEFAULT_WEIGHTS.complementarity +
      DEFAULT_WEIGHTS.interest;
    return {
      gapCoverage: (DEFAULT_WEIGHTS.gapCoverage / defaultOthersTotal) * remaining,
      availability: (DEFAULT_WEIGHTS.availability / defaultOthersTotal) * remaining,
      complementarity: (DEFAULT_WEIGHTS.complementarity / defaultOthersTotal) * remaining,
      interest: (DEFAULT_WEIGHTS.interest / defaultOthersTotal) * remaining,
      experience: experienceShare,
    };
  }

  return {
    gapCoverage: (others.gapCoverage / othersTotal) * remaining,
    availability: (others.availability / othersTotal) * remaining,
    complementarity: (others.complementarity / othersTotal) * remaining,
    interest: (others.interest / othersTotal) * remaining,
    experience: experienceShare,
  };
}

const DEFAULT_EXPERIENCE = 0.5;

function slotKey(s: AvailabilitySlot) {
  return `${s.dayOfWeek}-${s.block}`;
}

/** GapCoverage = Σ min(c[j], g[j]) / Σ g[j]; g[j] = max(0, r[j] - t[j]) */
export function computeGapCoverage(
  requirements: ProjectRequirement[],
  currentCoverage: TeamSkillCoverage[],
  candidateSkills: SkillLevel[],
): number {
  const tBySkill = new Map(currentCoverage.map((t) => [t.skillId, t.coverage]));
  const cBySkill = new Map(candidateSkills.map((c) => [c.skillId, c.level]));

  let sumMinCG = 0;
  let sumG = 0;

  for (const r of requirements) {
    const t = tBySkill.get(r.skillId) ?? 0;
    const g = Math.max(0, r.importance - t);
    const c = cBySkill.get(r.skillId) ?? 0;
    sumMinCG += Math.min(c, g);
    sumG += g;
  }

  // Tidak ada gap sama sekali (tim sudah menutupi seluruh requirement) ->
  // kandidat ini tidak menutup kebutuhan apa pun yang tersisa.
  if (sumG === 0) return 0;
  return sumMinCG / sumG;
}

/** Availability = |slot_kandidat ∩ slot_tim| / |slot_tim| */
export function computeAvailability(
  candidateSlots: AvailabilitySlot[],
  teamSlots: AvailabilitySlot[],
): number {
  if (teamSlots.length === 0) return 0;
  const teamSet = new Set(teamSlots.map(slotKey));
  const overlap = candidateSlots.filter((s) => teamSet.has(slotKey(s))).length;
  return overlap / teamSlots.length;
}

/**
 * Complementarity = 1 - Redundancy
 * Redundancy = Σ min(c[j], t[j]) / Σ c[j]  (Blueprint slide 15)
 */
export function computeComplementarity(
  currentCoverage: TeamSkillCoverage[],
  candidateSkills: SkillLevel[],
): number {
  const tBySkill = new Map(currentCoverage.map((t) => [t.skillId, t.coverage]));

  let sumMinCT = 0;
  let sumC = 0;

  for (const c of candidateSkills) {
    const t = tBySkill.get(c.skillId) ?? 0;
    sumMinCT += Math.min(c.level, t);
    sumC += c.level;
  }

  if (sumC === 0) return 1; // tidak ada skill yang tumpang tindih -> komplementer penuh
  const redundancy = sumMinCT / sumC;
  return 1 - redundancy;
}

/** Interest = |minat_kandidat ∩ tag_proyek| / |tag_proyek| */
export function computeInterest(
  candidateInterests: string[],
  projectTags: string[],
): number {
  if (projectTags.length === 0) return 0;
  const tagSet = new Set(projectTags.map((t) => t.toLowerCase()));
  const overlap = candidateInterests.filter((i) =>
    tagSet.has(i.toLowerCase()),
  ).length;
  return overlap / projectTags.length;
}

export type MatchBreakdown = {
  gapCoverage: number;
  availability: number;
  complementarity: number;
  interest: number;
  experience: number;
};

export type MatchResult = {
  candidateId: string;
  score: number;
  breakdown: MatchBreakdown;
  explanation: string;
};

const LABELS: Record<keyof MatchBreakdown, string> = {
  gapCoverage: "menutup gap tim yang paling dibutuhkan",
  availability: "ketersediaan waktu yang cocok dengan tim",
  complementarity: "skill yang melengkapi (tidak tumpang tindih)",
  interest: "minat yang sesuai topik proyek",
  experience: "pengalaman yang relevan",
};

// Bobot yang dipakai di sini HARUS bobot yang sama dengan yang dipakai
// menghitung skor (termasuk kustom owner) — kalau tidak, kalimat
// penjelasan bisa menyebut komponen yang sebenarnya BUKAN penyumbang
// terbesar menurut bobot proyek itu.
function buildExplanation(
  breakdown: MatchBreakdown,
  weights: MatchWeights,
  /** Nama skill requirement yang benar-benar ditutup kandidat ini, terurut
   *  dari sumbangan terbesar. Kosong kalau tidak menutup gap apa pun. */
  coveredGapSkills: string[] = [],
): string {
  const weighted = (Object.keys(breakdown) as (keyof MatchBreakdown)[]).map(
    (key) => ({ key, contribution: breakdown[key] * weights[key] }),
  );
  weighted.sort((a, b) => b.contribution - a.contribution);
  const [top1, top2] = weighted;
  // Nilai mentah tiap komponen ikut disebut. Tanpa ini, kandidat yang
  // kebetulan punya dua komponen teratas yang sama akan mendapat kalimat
  // yang PERSIS SAMA — terlihat seperti template yang ditempel, bukan
  // penjelasan. Terlihat jelas saat pengujian browser: tiga kandidat
  // teratas semuanya berbunyi identik.
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // Kalau kandidat menutup requirement yang konkret, ITU yang dijadikan
  // kalimat pembuka. Alasannya ditemukan lewat pengujian browser 3
  // September: di halaman Tim, SEPULUH kandidat teratas semuanya dibuka
  // dengan "skill yang melengkapi (100%)" — bukan karena skornya salah,
  // tapi karena kandidat tanpa tumpang tindih memang otomatis terlempar ke
  // peringkat atas (efek seleksi). Komponen yang bernilai sama untuk semua
  // orang tidak menjelaskan apa pun, jadi pembacanya harus membaca sampai
  // habis baru menemukan bedanya. Nama skill dipindah ke depan; komponen
  // pembanding diambil dari peringkat teratas SELAIN gapCoverage supaya
  // tidak mengulang hal yang sama dua kali.
  if (coveredGapSkills.length > 0) {
    const named = coveredGapSkills.slice(0, 2).join(" dan ");
    const other = weighted.find((w) => w.key !== "gapCoverage")!;
    return (
      `Menutup kebutuhan ${named} yang belum tertutup tim ` +
      `(${pct(breakdown.gapCoverage)} dari total gap), ditambah ` +
      `${LABELS[other.key]} (${pct(breakdown[other.key])}).`
    );
  }

  return (
    `Direkomendasikan terutama karena ${LABELS[top1.key]} (${pct(breakdown[top1.key])}) ` +
    `dan ${LABELS[top2.key]} (${pct(breakdown[top2.key])}).`
  );
}

/**
 * Requirement mana yang benar-benar ditutup kandidat ini, terurut dari
 * sumbangan terbesar ke GapCoverage. Memakai definisi gap yang sama persis
 * dengan computeGapCoverage — min(c[j], g[j]) dengan g[j] = max(0, r-t) —
 * supaya kalimat penjelasan tidak pernah menyebut skill yang sebenarnya
 * tidak menyumbang skor.
 */
export function coveredGapSkillIds(
  requirements: ProjectRequirement[],
  currentCoverage: TeamSkillCoverage[],
  candidateSkills: SkillLevel[],
): string[] {
  const tBySkill = new Map(currentCoverage.map((t) => [t.skillId, t.coverage]));
  const cBySkill = new Map(candidateSkills.map((c) => [c.skillId, c.level]));

  return requirements
    .map((r) => {
      const gap = Math.max(0, r.importance - (tBySkill.get(r.skillId) ?? 0));
      return {
        skillId: r.skillId,
        contribution: Math.min(cBySkill.get(r.skillId) ?? 0, gap),
      };
    })
    .filter((x) => x.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .map((x) => x.skillId);
}

/**
 * Match(c, P, T) = 0.35·GapCoverage + 0.20·Availability + 0.15·Complementarity
 *                + 0.15·Interest + 0.15·Experience
 */
export function computeMatch(
  candidate: Candidate,
  requirements: ProjectRequirement[],
  projectTags: string[],
  team: TeamContext,
  /** Bobot kustom owner (keputusan #6 Lampiran C). Selalu dilewatkan
   *  sanitizeWeights — cap Experience 0.15 tidak bisa ditembus dari sini. */
  weights?: Partial<MatchWeights> | null,
): MatchResult {
  const gapCoverage = computeGapCoverage(
    requirements,
    team.currentCoverage,
    candidate.skills,
  );
  const availability = computeAvailability(
    candidate.availability,
    team.teamAvailability,
  );
  const complementarity = computeComplementarity(
    team.currentCoverage,
    candidate.skills,
  );
  const interest = computeInterest(candidate.interests, projectTags);
  const experience = candidate.experience ?? DEFAULT_EXPERIENCE;

  const breakdown: MatchBreakdown = {
    gapCoverage,
    availability,
    complementarity,
    interest,
    experience,
  };

  const w = sanitizeWeights(weights);
  const score =
    w.gapCoverage * gapCoverage +
    w.availability * availability +
    w.complementarity * complementarity +
    w.interest * interest +
    w.experience * experience;

  return {
    candidateId: candidate.profileId,
    score,
    breakdown,
    explanation: buildExplanation(
      breakdown,
      w,
      team.skillNames
        ? coveredGapSkillIds(requirements, team.currentCoverage, candidate.skills)
            .map((id) => team.skillNames!.get(id))
            .filter((n): n is string => Boolean(n))
        : [],
    ),
  };
}

/**
 * Anti-bias (Blueprint Bagian 08 Masalah 4): satu dari lima kandidat teratas
 * WAJIB slot eksplorasi — pengalaman rendah tapi GapCoverage tinggi. Dipakai
 * setelah computeMatch dipanggil untuk seluruh kandidat dan diurutkan.
 *
 * `results` HARUS sudah terurut menurun berdasarkan score sebelum dipanggil.
 */
export function applyExplorationSlot(results: MatchResult[]): MatchResult[] {
  if (results.length <= 4) return results;

  const top5 = results.slice(0, 5);
  const alreadyHasLowExperienceHighGap = top5.some(
    (r) => r.breakdown.experience <= 0.5 && r.breakdown.gapCoverage >= 0.6,
  );
  if (alreadyHasLowExperienceHighGap) return results;

  const rest = results.slice(5);
  const explorationCandidateIndex = rest.findIndex(
    (r) => r.breakdown.experience <= 0.5 && r.breakdown.gapCoverage >= 0.6,
  );
  if (explorationCandidateIndex === -1) return results;

  const explorationCandidate = rest[explorationCandidateIndex];
  const reordered = [
    ...top5.slice(0, 4),
    explorationCandidate,
    ...results.filter(
      (r) => r.candidateId !== explorationCandidate.candidateId,
    ).slice(4),
  ];
  return reordered;
}
