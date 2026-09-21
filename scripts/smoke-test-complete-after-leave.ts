// QA kasus tepi (RENCANA-EKSEKUSI-20-SEP.md item #7): "tutup proyek setelah
// ada anggota yang keluar — jenjang bukti 1.00 hanya boleh naik untuk
// anggota AKTIF". Data uji (proyek + skill + ProfileSkill throwaway) dibuat
// dan dihapus lagi di akhir; profil kandidat dipakai apa adanya tanpa
// mengubah skill asli mereka. Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-complete-after-leave.ts
import { prisma } from "../src/lib/prisma";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";
const SKILL_NAME = "__smoketest-complete-after-leave";

async function main() {
  const [stayingMember, leavingMember] = await prisma.profile.findMany({
    where: { id: { not: OWNER_ID } },
    take: 2,
  });
  console.log("Anggota uji:", stayingMember.fullName, "(tetap) &", leavingMember.fullName, "(keluar)");

  const skill = await prisma.skill.create({ data: { name: SKILL_NAME } });

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ownerId: OWNER_ID, title: "__smoketest complete-after-leave", goal: "uji jenjang bukti setelah anggota keluar", status: "ACTIVE" },
    });
    await tx.requirement.create({ data: { projectId: p.id, skillId: skill.id, importance: 1 } });
    const team = await tx.team.create({
      data: {
        projectId: p.id,
        members: {
          create: [
            { profileId: OWNER_ID, role: "Owner" },
            { profileId: stayingMember.id, role: "Member" },
            { profileId: leavingMember.id, role: "Member" },
          ],
        },
      },
    });
    return { ...p, teamId: team.id };
  });
  console.log("Proyek uji:", project.id);

  // Kedua anggota mengklaim skill requirement di level rendah (0.5), sama
  // seperti addSkillAction — supaya bisa dibedakan dari 1.00 hasil upgrade.
  await prisma.profileSkill.createMany({
    data: [
      { profileId: stayingMember.id, skillId: skill.id, evidenceLevel: 0.5 },
      { profileId: leavingMember.id, skillId: skill.id, evidenceLevel: 0.5 },
    ],
  });

  // --- Simulasi leaveProjectAction: leavingMember keluar SEBELUM proyek ditutup ---
  await prisma.teamMember.updateMany({
    where: { team: { projectId: project.id }, profileId: leavingMember.id },
    data: { status: "LEFT", leftAt: new Date() },
  });
  console.log("1. leavingMember keluar dari tim sebelum proyek ditutup.");

  // --- Simulasi PERSIS logika completeProjectAction (projects.ts) ---
  const PROJECT_COMPLETION_LEVEL = 1.0;
  const [requirements, activeMembers] = await Promise.all([
    prisma.requirement.findMany({ where: { projectId: project.id }, select: { skillId: true } }),
    prisma.teamMember.findMany({
      where: { team: { projectId: project.id }, status: "ACTIVE" },
      select: { profileId: true },
    }),
  ]);
  const requiredSkillIds = requirements.map((r) => r.skillId);
  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: project.id }, data: { status: "COMPLETED" } });
    if (requiredSkillIds.length > 0 && activeMembers.length > 0) {
      const toUpgrade = await tx.profileSkill.findMany({
        where: {
          profileId: { in: activeMembers.map((m) => m.profileId) },
          skillId: { in: requiredSkillIds },
          evidenceLevel: { lt: PROJECT_COMPLETION_LEVEL },
        },
        select: { id: true },
      });
      if (toUpgrade.length > 0) {
        await tx.profileSkill.updateMany({
          where: { id: { in: toUpgrade.map((r) => r.id) } },
          data: { evidenceLevel: PROJECT_COMPLETION_LEVEL },
        });
      }
    }
  });
  console.log("2. Owner menutup proyek (completeProjectAction).");

  const stayingSkill = await prisma.profileSkill.findUnique({
    where: { profileId_skillId: { profileId: stayingMember.id, skillId: skill.id } },
  });
  const leavingSkill = await prisma.profileSkill.findUnique({
    where: { profileId_skillId: { profileId: leavingMember.id, skillId: skill.id } },
  });
  console.log("3. evidenceLevel stayingMember:", stayingSkill?.evidenceLevel, "(harus 1)");
  console.log("4. evidenceLevel leavingMember:", leavingSkill?.evidenceLevel, "(harus TETAP 0.5, TIDAK naik)");

  const auditLogs = await prisma.auditLog.findMany({ where: { projectId: project.id } });
  console.log("5. Audit log tercatat:", auditLogs.length, "entri (bukan 0 — leaveProjectAction sungguhan selalu logAudit; di sini disimulasikan tanpa logAudit, cek terpisah)");

  const ok = stayingSkill?.evidenceLevel === 1 && leavingSkill?.evidenceLevel === 0.5;
  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  await prisma.profileSkill.deleteMany({ where: { skillId: skill.id } });
  await prisma.auditLog.deleteMany({ where: { projectId: project.id } });
  await prisma.teamMember.deleteMany({ where: { team: { projectId: project.id } } });
  await prisma.team.deleteMany({ where: { projectId: project.id } });
  await prisma.requirement.deleteMany({ where: { projectId: project.id } });
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
