// QA sementara untuk bobot skor kustom owner (keputusan #6 Lampiran C):
// memastikan bobot yang disimpan di Project benar-benar mengubah peringkat
// kandidat, dan cap anti-bias Experience tetap tegak lewat jalur database.
// Jalankan: npx tsx --env-file=.env scripts/smoke-test-match-weights.ts
import { prisma } from "../src/lib/prisma";
import {
  computeMatch,
  sanitizeWeights,
  MAX_EXPERIENCE_WEIGHT,
  type Candidate,
  type TeamContext,
} from "../src/lib/matching/score";

async function main() {
  const project = await prisma.project.findFirst({
    where: { title: { contains: "Peta Ruang Terbuka Hijau" } },
    include: { requirements: true },
  });
  if (!project) throw new Error("Proyek seed A tidak ditemukan — jalankan `pnpm seed` dulu.");
  console.log("Proyek:", project.title);

  const members = await prisma.teamMember.findMany({
    where: { team: { projectId: project.id }, status: "ACTIVE" },
    include: { profile: { include: { skills: true, availability: true } } },
  });
  const memberIds = members.map((m) => m.profileId);

  const coverageBySkill = new Map<string, number>();
  for (const m of members) {
    for (const ps of m.profile.skills) {
      coverageBySkill.set(ps.skillId, Math.max(coverageBySkill.get(ps.skillId) ?? 0, ps.evidenceLevel));
    }
  }
  const teamContext: TeamContext = {
    requirements: project.requirements.map((r) => ({ skillId: r.skillId, importance: r.importance })),
    currentCoverage: Array.from(coverageBySkill.entries()).map(([skillId, coverage]) => ({ skillId, coverage })),
    teamAvailability: members.flatMap((m) => m.profile.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, block: a.block }))),
  };

  const profiles = await prisma.profile.findMany({
    where: { id: { notIn: memberIds } },
    include: { skills: true, availability: true },
    take: 30,
  });
  const candidates: Candidate[] = profiles.map((p) => ({
    profileId: p.id,
    skills: p.skills.map((s) => ({ skillId: s.skillId, level: s.evidenceLevel })),
    availability: p.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, block: a.block })),
    interests: p.interests,
  }));

  const rank = (weights: Parameters<typeof computeMatch>[4]) =>
    candidates
      .map((c) => computeMatch(c, teamContext.requirements, project.tags, teamContext, weights))
      .sort((a, b) => b.score - a.score);

  const defaultTop = rank(null).slice(0, 3).map((r) => r.candidateId);
  // Bobot ekstrem: hampir semua ke Availability (irisan jadwal).
  const availabilityHeavy = rank({ gapCoverage: 0.05, availability: 0.9, complementarity: 0.05, interest: 0, experience: 0 });
  const availTop = availabilityHeavy.slice(0, 3).map((r) => r.candidateId);

  console.log("1. Top 3 dengan bobot default   :", defaultTop);
  console.log("2. Top 3 dengan bobot Availability-berat:", availTop);
  const rankingChanged = JSON.stringify(defaultTop) !== JSON.stringify(availTop);
  console.log("3. Peringkat berubah saat bobot diubah?", rankingChanged, "(harus true)");

  // Cap anti-bias lewat jalur simpan-ke-database.
  const abusive = sanitizeWeights({ gapCoverage: 0.1, availability: 0, complementarity: 0, interest: 0, experience: 99 });
  console.log("4. Owner coba set Experience=99 -> bobot akhir:", abusive.experience.toFixed(4), `(harus <= ${MAX_EXPERIENCE_WEIGHT})`);
  const total = abusive.gapCoverage + abusive.availability + abusive.complementarity + abusive.interest + abusive.experience;
  console.log("5. Total bobot setelah sanitasi:", total.toFixed(4), "(harus 1.0000)");

  const ok =
    rankingChanged &&
    abusive.experience <= MAX_EXPERIENCE_WEIGHT + 1e-9 &&
    Math.abs(total - 1) < 1e-9;

  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("SMOKE TEST GAGAL:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
