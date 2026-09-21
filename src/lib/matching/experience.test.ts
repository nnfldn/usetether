import { describe, it, expect } from "vitest";
import {
  computeExperience,
  computePeerRatingNorm,
  MIN_PEER_RATERS,
  PEER_RATING_NEUTRAL,
} from "./experience";

/** Penilaian sempurna (5/5/5) dari penilai bernama `id`. */
const sempurna = (id: string) => ({
  raterId: id,
  timeliness: 5,
  quality: 5,
  communication: 5,
});
/** Penilaian terburuk (1/1/1) dari penilai bernama `id`. */
const terburuk = (id: string) => ({
  raterId: id,
  timeliness: 1,
  quality: 1,
  communication: 1,
});

describe("computePeerRatingNorm (pagar anti-gaming)", () => {
  it("netral kalau belum ada penilaian sama sekali", () => {
    expect(computePeerRatingNorm([])).toBe(PEER_RATING_NEUTRAL);
  });

  it("netral selama penilai berbeda masih di bawah ambang", () => {
    const ratings = Array.from({ length: MIN_PEER_RATERS - 1 }, (_, i) =>
      sempurna(`p${i}`),
    );
    expect(computePeerRatingNorm(ratings)).toBe(PEER_RATING_NEUTRAL);
  });

  it("SATU orang tidak bisa mengangkat siapa pun sendirian, sebanyak apa pun penilaiannya", () => {
    // Skenario manipulasi: satu penilai memberi nilai sempurna di 10 proyek.
    const ratings = Array.from({ length: 10 }, () => sempurna("penilai-tunggal"));
    expect(computePeerRatingNorm(ratings)).toBe(PEER_RATING_NEUTRAL);
  });

  it("SATU orang juga tidak bisa menjatuhkan siapa pun sendirian", () => {
    const ratings = Array.from({ length: 10 }, () => terburuk("pendendam"));
    expect(computePeerRatingNorm(ratings)).toBe(PEER_RATING_NEUTRAL);
  });

  it("aktif begitu penilai berbeda mencapai ambang", () => {
    const ratings = Array.from({ length: MIN_PEER_RATERS }, (_, i) =>
      sempurna(`p${i}`),
    );
    expect(computePeerRatingNorm(ratings)).toBe(1);
  });

  it("nilai terendah memetakan ke 0, bukan 0.2", () => {
    const ratings = Array.from({ length: MIN_PEER_RATERS }, (_, i) =>
      terburuk(`p${i}`),
    );
    expect(computePeerRatingNorm(ratings)).toBe(0);
  });

  it("nilai tengah (3/5) memetakan ke 0.5", () => {
    const ratings = Array.from({ length: MIN_PEER_RATERS }, (_, i) => ({
      raterId: `p${i}`,
      timeliness: 3,
      quality: 3,
      communication: 3,
    }));
    expect(computePeerRatingNorm(ratings)).toBeCloseTo(0.5);
  });

  it("merata-ratakan ketiga dimensi dengan bobot sama", () => {
    const ratings = Array.from({ length: MIN_PEER_RATERS }, (_, i) => ({
      raterId: `p${i}`,
      timeliness: 5,
      quality: 1,
      communication: 3,
    }));
    // rata-rata dimensi = 3 -> norm 0.5
    expect(computePeerRatingNorm(ratings)).toBeCloseTo(0.5);
  });
});

describe("computeExperience", () => {
  it("kembalikan undefined kalau belum pernah selesaikan proyek (cold start)", () => {
    expect(
      computeExperience({ completedProjectsCount: 0, completedMilestonesOnTime: 0, completedMilestonesTotal: 0 }),
    ).toBeUndefined();
  });

  it("proyek selesai tapi tidak pernah pegang milestone -> onTimeRate netral 0.5", () => {
    const score = computeExperience({ completedProjectsCount: 1, completedMilestonesOnTime: 0, completedMilestonesTotal: 0 });
    // 0.5*0.5 (netral) + 0.3*0.5 (peer rating netral) + 0.2*(1/5) = 0.25+0.15+0.04 = 0.44
    expect(score).toBeCloseTo(0.44, 5);
  });

  it("semua milestone tepat waktu + banyak proyek selesai -> skor tinggi", () => {
    const score = computeExperience({ completedProjectsCount: 5, completedMilestonesOnTime: 10, completedMilestonesTotal: 10 });
    // 0.5*1 + 0.3*0.5 + 0.2*1 = 0.5+0.15+0.2 = 0.85
    expect(score).toBeCloseTo(0.85, 5);
  });

  it("projectsCompletedNorm dibatasi maksimum 1 (cap 5 proyek)", () => {
    const score = computeExperience({ completedProjectsCount: 50, completedMilestonesOnTime: 1, completedMilestonesTotal: 1 });
    expect(score).toBeCloseTo(0.5 * 1 + 0.3 * 0.5 + 0.2 * 1, 5);
  });

  it("selalu di rentang 0..1", () => {
    const score = computeExperience({ completedProjectsCount: 1, completedMilestonesOnTime: 0, completedMilestonesTotal: 5 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("computeExperience dengan peer rating", () => {
  const dasar = {
    completedProjectsCount: 5,
    completedMilestonesOnTime: 10,
    completedMilestonesTotal: 10,
  };

  it("tanpa peerRatingNorm -> perilaku lama (netral 0.5)", () => {
    // 0.5*1 + 0.3*0.5 + 0.2*1 = 0.85
    expect(computeExperience(dasar)).toBeCloseTo(0.85);
  });

  it("peer rating sempurna menaikkan skor tepat sebesar bobotnya (0.3)", () => {
    const netral = computeExperience(dasar)!;
    const penuh = computeExperience({ ...dasar, peerRatingNorm: 1 })!;
    expect(penuh - netral).toBeCloseTo(0.3 * 0.5);
    expect(penuh).toBeCloseTo(1);
  });

  it("peer rating terburuk menurunkan skor tepat sebesar bobotnya", () => {
    const netral = computeExperience(dasar)!;
    const nol = computeExperience({ ...dasar, peerRatingNorm: 0 })!;
    expect(netral - nol).toBeCloseTo(0.3 * 0.5);
  });

  it("cold start tetap menang atas peer rating: belum pernah selesai -> undefined", () => {
    expect(
      computeExperience({
        completedProjectsCount: 0,
        completedMilestonesOnTime: 0,
        completedMilestonesTotal: 0,
        peerRatingNorm: 1,
      }),
    ).toBeUndefined();
  });
});
