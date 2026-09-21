import { describe, it, expect } from "vitest";
import {
  computeGapCoverage,
  coveredGapSkillIds,
  computeAvailability,
  computeComplementarity,
  computeInterest,
  computeMatch,
  applyExplorationSlot,
  sanitizeWeights,
  DEFAULT_WEIGHTS,
  MAX_EXPERIENCE_WEIGHT,
  type Candidate,
  type TeamContext,
  type MatchResult,
} from "./score";

describe("sanitizeWeights (pagar anti-bias bobot kustom owner)", () => {
  const sum = (w: ReturnType<typeof sanitizeWeights>) =>
    w.gapCoverage + w.availability + w.complementarity + w.interest + w.experience;

  it("tanpa input, pakai bobot default Blueprint", () => {
    expect(sanitizeWeights(null)).toEqual(DEFAULT_WEIGHTS);
  });

  it("selalu menormalisasi total jadi 1", () => {
    const w = sanitizeWeights({ gapCoverage: 2, availability: 2, complementarity: 2, interest: 2, experience: 0.1 });
    expect(sum(w)).toBeCloseTo(1, 6);
  });

  it("Experience TIDAK PERNAH melebihi cap, berapa pun owner mengisinya", () => {
    const w = sanitizeWeights({ gapCoverage: 0.1, availability: 0, complementarity: 0, interest: 0, experience: 99 });
    expect(w.experience).toBeLessThanOrEqual(MAX_EXPERIENCE_WEIGHT + 1e-9);
    expect(sum(w)).toBeCloseTo(1, 6);
  });

  it("cap tetap tegak SETELAH normalisasi, bukan cuma pada angka mentah", () => {
    // Kasus jebakan: kalau di-cap dulu (0.15) baru dinormalisasi terhadap
    // total kecil (0.1+0.15), experience akan meledak jadi 0.6.
    const w = sanitizeWeights({ gapCoverage: 0.1, availability: 0, complementarity: 0, interest: 0, experience: 0.15 });
    expect(w.experience).toBeLessThanOrEqual(MAX_EXPERIENCE_WEIGHT + 1e-9);
  });

  it("owner cuma mengisi Experience -> sisanya dibagi mengikuti proporsi default, bukan nol semua", () => {
    const w = sanitizeWeights({ gapCoverage: 0, availability: 0, complementarity: 0, interest: 0, experience: 1 });
    expect(w.experience).toBeCloseTo(MAX_EXPERIENCE_WEIGHT, 6);
    expect(w.gapCoverage).toBeGreaterThan(0);
    expect(sum(w)).toBeCloseTo(1, 6);
  });

  it("semua nol -> balik ke default (bukan NaN atau nol semua)", () => {
    expect(sanitizeWeights({ gapCoverage: 0, availability: 0, complementarity: 0, interest: 0, experience: 0 })).toEqual(
      DEFAULT_WEIGHTS,
    );
  });

  it("bobot negatif diperlakukan sebagai nol, tidak pernah mengurangi skor", () => {
    const w = sanitizeWeights({ gapCoverage: 1, availability: -5, complementarity: 0, interest: 0, experience: 0 });
    expect(w.availability).toBe(0);
    expect(sum(w)).toBeCloseTo(1, 6);
  });
});

describe("computeGapCoverage", () => {
  it("mengembalikan 0 kalau tim sudah menutupi semua requirement", () => {
    const score = computeGapCoverage(
      [{ skillId: "react", importance: 0.8 }],
      [{ skillId: "react", coverage: 0.8 }],
      [{ skillId: "react", level: 1 }],
    );
    expect(score).toBe(0);
  });

  it("menghitung rasio gap yang tertutup kandidat", () => {
    // g[react] = max(0, 0.8 - 0.2) = 0.6, c = 0.5 -> min(0.5,0.6)=0.5
    // g[design] = max(0, 0.5 - 0) = 0.5, c = 0 -> min(0,0.5)=0
    // sumMinCG = 0.5, sumG = 1.1
    const score = computeGapCoverage(
      [
        { skillId: "react", importance: 0.8 },
        { skillId: "design", importance: 0.5 },
      ],
      [{ skillId: "react", coverage: 0.2 }],
      [{ skillId: "react", level: 0.5 }],
    );
    expect(score).toBeCloseTo(0.5 / 1.1);
  });

  it("mengembalikan 0 kalau tidak ada requirement sama sekali (sumG=0)", () => {
    expect(computeGapCoverage([], [], [{ skillId: "react", level: 1 }])).toBe(0);
  });
});

describe("coveredGapSkillIds (bahan kalimat penjelasan)", () => {
  it("mengurutkan dari sumbangan terbesar", () => {
    const ids = coveredGapSkillIds(
      [
        { skillId: "react", importance: 0.9 },
        { skillId: "design", importance: 0.4 },
      ],
      [],
      [
        { skillId: "react", level: 0.6 },
        { skillId: "design", level: 0.8 },
      ],
    );
    // react: min(0.6, 0.9) = 0.6 ; design: min(0.8, 0.4) = 0.4
    expect(ids).toEqual(["react", "design"]);
  });

  it("tidak menyebut skill yang gap-nya sudah ditutup tim", () => {
    const ids = coveredGapSkillIds(
      [{ skillId: "react", importance: 0.8 }],
      [{ skillId: "react", coverage: 0.8 }],
      [{ skillId: "react", level: 1 }],
    );
    expect(ids).toEqual([]);
  });

  it("tidak menyebut skill yang tidak dimiliki kandidat", () => {
    const ids = coveredGapSkillIds(
      [{ skillId: "react", importance: 0.8 }],
      [],
      [{ skillId: "python", level: 1 }],
    );
    expect(ids).toEqual([]);
  });

  it("konsisten dengan computeGapCoverage: kosong berarti skor gap 0", () => {
    const reqs = [{ skillId: "react", importance: 0.8 }];
    const cov = [{ skillId: "react", coverage: 0.8 }];
    const skills = [{ skillId: "react", level: 1 }];
    expect(coveredGapSkillIds(reqs, cov, skills)).toEqual([]);
    expect(computeGapCoverage(reqs, cov, skills)).toBe(0);
  });
});

describe("computeAvailability", () => {
  it("0 kalau tim belum punya slot ketersediaan", () => {
    expect(computeAvailability([{ dayOfWeek: 1, block: "SORE" }], [])).toBe(0);
  });

  it("rasio irisan terhadap slot tim, bukan jumlah jam kandidat", () => {
    const teamSlots = [
      { dayOfWeek: 1, block: "SORE" },
      { dayOfWeek: 2, block: "MALAM" },
    ];
    // kandidat hanya cocok 1 dari 2 slot tim, walau kandidat sendiri punya 3 slot
    const candidateSlots = [
      { dayOfWeek: 1, block: "SORE" },
      { dayOfWeek: 5, block: "PAGI" },
      { dayOfWeek: 6, block: "PAGI" },
    ];
    expect(computeAvailability(candidateSlots, teamSlots)).toBe(0.5);
  });
});

describe("computeComplementarity", () => {
  it("1 (komplementer penuh) kalau kandidat tidak overlap sama sekali dengan tim", () => {
    const score = computeComplementarity(
      [{ skillId: "react", coverage: 0.9 }],
      [{ skillId: "design", level: 0.7 }],
    );
    expect(score).toBe(1);
  });

  it("mendekati 0 (redundan) kalau skill kandidat sama persis dengan tim", () => {
    const score = computeComplementarity(
      [{ skillId: "react", coverage: 0.8 }],
      [{ skillId: "react", level: 0.8 }],
    );
    expect(score).toBe(0);
  });
});

describe("computeInterest", () => {
  it("0 kalau proyek tidak punya tag", () => {
    expect(computeInterest(["web"], [])).toBe(0);
  });

  it("cocok tanpa peduli huruf besar/kecil", () => {
    expect(computeInterest(["Web", "AI"], ["web", "mobile"])).toBe(0.5);
  });
});

describe("computeMatch", () => {
  const team: TeamContext = {
    requirements: [{ skillId: "react", importance: 0.8 }],
    currentCoverage: [],
    teamAvailability: [{ dayOfWeek: 1, block: "SORE" }],
  };

  it("skor 0..1 dan menyertakan penjelasan dua komponen teratas", () => {
    const candidate: Candidate = {
      profileId: "c1",
      skills: [{ skillId: "react", level: 0.8 }],
      availability: [{ dayOfWeek: 1, block: "SORE" }],
      interests: [],
    };
    const result = computeMatch(candidate, team.requirements, [], team);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.explanation).toContain("Direkomendasikan terutama karena");
  });

  it("pengguna baru tanpa riwayat dapat experience netral 0.5, bukan dihukum ke 0", () => {
    const candidate: Candidate = {
      profileId: "c2",
      skills: [],
      availability: [],
      interests: [],
    };
    const result = computeMatch(candidate, team.requirements, [], team);
    expect(result.breakdown.experience).toBe(0.5);
  });
});

describe("applyExplorationSlot", () => {
  function fakeResult(id: string, score: number, experience: number, gapCoverage: number): MatchResult {
    return {
      candidateId: id,
      score,
      breakdown: { gapCoverage, availability: 0, complementarity: 0, interest: 0, experience },
      explanation: "",
    };
  }

  it("tidak mengubah apa pun kalau kandidat <= 4", () => {
    const results = [fakeResult("a", 0.9, 0.9, 0.1)];
    expect(applyExplorationSlot(results)).toEqual(results);
  });

  it("tidak mengubah urutan kalau top-5 sudah punya kandidat eksplorasi", () => {
    const results = [
      fakeResult("a", 0.9, 0.9, 0.9),
      fakeResult("b", 0.8, 0.2, 0.7), // sudah memenuhi syarat eksplorasi
      fakeResult("c", 0.7, 0.9, 0.9),
      fakeResult("d", 0.6, 0.9, 0.9),
      fakeResult("e", 0.5, 0.9, 0.9),
      fakeResult("f", 0.4, 0.1, 0.9),
    ];
    expect(applyExplorationSlot(results)).toEqual(results);
  });

  it("menyisipkan kandidat eksplorasi dari luar top-5 ke posisi ke-5", () => {
    const results = [
      fakeResult("a", 0.9, 0.9, 0.9),
      fakeResult("b", 0.8, 0.9, 0.9),
      fakeResult("c", 0.7, 0.9, 0.9),
      fakeResult("d", 0.6, 0.9, 0.9),
      fakeResult("e", 0.5, 0.9, 0.9),
      fakeResult("explorer", 0.2, 0.3, 0.7), // experience<=0.5 & gapCoverage>=0.6
      fakeResult("f", 0.1, 0.9, 0.9),
    ];
    const reordered = applyExplorationSlot(results);
    expect(reordered[4].candidateId).toBe("explorer");
    expect(reordered).toHaveLength(results.length);
    // tidak ada kandidat yang hilang atau duplikat
    expect(new Set(reordered.map((r) => r.candidateId)).size).toBe(results.length);
  });
});
