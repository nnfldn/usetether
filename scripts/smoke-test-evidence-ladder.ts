// QA sementara untuk jenjang bukti skill 0.80 (endorsement rekan) & 1.00
// (proyek selesai) — schema.prisma model SkillEndorsement, actions/team.ts
// endorseSkillAction, actions/projects.ts completeProjectAction. Data uji
// dibuat dan dihapus lagi di akhir. Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-evidence-ladder.ts
import { prisma } from "../src/lib/prisma";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";

async function main() {
  const [memberA] = await prisma.profile.findMany({ where: { id: { not: OWNER_ID } }, take: 1 });
  console.log("Anggota uji:", memberA.fullName);

  const skill = await prisma.skill.upsert({
    where: { name: "__smoketest-skill" },
    create: { name: "__smoketest-skill" },
    update: {},
  });

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ownerId: OWNER_ID, title: "__smoketest evidence-ladder", goal: "uji jenjang bukti skill", status: "ACTIVE" },
    });
    await tx.requirement.create({ data: { projectId: p.id, skillId: skill.id, importance: 0.8 } });
    await tx.team.create({
      data: {
        projectId: p.id,
        members: { create: [{ profileId: OWNER_ID, role: "Owner" }, { profileId: memberA.id, role: "Member" }] },
      },
    });
    return p;
  });
  console.log("Proyek uji:", project.id);

  // memberA klaim skill secara mandiri (0.50) — simulasi addSkillAction.
  const profileSkill = await prisma.profileSkill.upsert({
    where: { profileId_skillId: { profileId: memberA.id, skillId: skill.id } },
    create: { profileId: memberA.id, skillId: skill.id, evidenceLevel: 0.5 },
    update: { evidenceLevel: 0.5 },
  });
  console.log("1. memberA klaim skill mandiri -> evidenceLevel:", profileSkill.evidenceLevel, "(harus 0.5)");

  // --- Simulasi endorseSkillAction: owner endorse skill memberA ---
  await prisma.$transaction(async (tx) => {
    await tx.skillEndorsement.upsert({
      where: { profileSkillId_endorserId: { profileSkillId: profileSkill.id, endorserId: OWNER_ID } },
      create: { profileSkillId: profileSkill.id, endorserId: OWNER_ID },
      update: {},
    });
    await tx.profileSkill.update({
      where: { id: profileSkill.id },
      data: { evidenceLevel: Math.max(profileSkill.evidenceLevel, 0.8) },
    });
  });
  const afterEndorse = await prisma.profileSkill.findUniqueOrThrow({ where: { id: profileSkill.id } });
  console.log("2. owner endorse skill memberA -> evidenceLevel:", afterEndorse.evidenceLevel, "(harus 0.8)");

  // --- Simulasi addSkillAction (edit ulang tanpa portofolio) TIDAK BOLEH menurunkan level ---
  const selfClaimedLevel = 0.5; // computeSelfClaimedLevel tanpa portofolio
  const regressionGuardedLevel = Math.max(afterEndorse.evidenceLevel, selfClaimedLevel);
  await prisma.profileSkill.update({ where: { id: profileSkill.id }, data: { evidenceLevel: regressionGuardedLevel } });
  const afterReEdit = await prisma.profileSkill.findUniqueOrThrow({ where: { id: profileSkill.id } });
  console.log("3. memberA edit ulang profil (tanpa portofolio) -> evidenceLevel:", afterReEdit.evidenceLevel, "(harus TETAP 0.8, bukan turun ke 0.5)");

  // --- Simulasi completeProjectAction: proyek selesai -> upgrade ke 1.00 untuk skill yang jadi requirement ---
  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: project.id }, data: { status: "COMPLETED" } });
    await tx.profileSkill.updateMany({
      where: { id: profileSkill.id, evidenceLevel: { lt: 1.0 } },
      data: { evidenceLevel: 1.0 },
    });
  });
  const afterComplete = await prisma.profileSkill.findUniqueOrThrow({ where: { id: profileSkill.id } });
  const finalProject = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
  console.log("4. proyek ditandai selesai -> evidenceLevel:", afterComplete.evidenceLevel, "(harus 1.0), project.status:", finalProject.status, "(harus COMPLETED)");

  const ok =
    profileSkill.evidenceLevel === 0.5 &&
    afterEndorse.evidenceLevel === 0.8 &&
    afterReEdit.evidenceLevel === 0.8 &&
    afterComplete.evidenceLevel === 1.0 &&
    finalProject.status === "COMPLETED";

  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  await prisma.skillEndorsement.deleteMany({ where: { profileSkillId: profileSkill.id } });
  await prisma.profileSkill.delete({ where: { id: profileSkill.id } });
  await prisma.requirement.deleteMany({ where: { projectId: project.id } });
  await prisma.teamMember.deleteMany({ where: { team: { projectId: project.id } } });
  await prisma.team.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.skill.delete({ where: { id: skill.id } });
  console.log("Data uji dihapus.");
}

main()
  .catch((e) => {
    console.error("SMOKE TEST GAGAL:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
