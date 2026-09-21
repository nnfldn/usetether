// QA sementara untuk AuditLog + leaveProjectAction. Data uji dibuat dan
// dihapus lagi di akhir. Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-audit-log.ts
import { prisma } from "../src/lib/prisma";
import { logAudit } from "../src/lib/audit";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";

async function main() {
  const [memberA] = await prisma.profile.findMany({ where: { id: { not: OWNER_ID } }, take: 1 });
  console.log("Anggota uji:", memberA.fullName);

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ownerId: OWNER_ID, title: "__smoketest audit-log", goal: "uji audit log & leave", status: "ACTIVE" },
    });
    const team = await tx.team.create({ data: { projectId: p.id, members: { create: { profileId: OWNER_ID, role: "Owner" } } } });
    await tx.teamMember.create({ data: { teamId: team.id, profileId: memberA.id, role: "Member" } });
    return p;
  });
  console.log("Proyek uji:", project.id);

  await logAudit({ projectId: project.id, actorId: OWNER_ID, targetProfileId: memberA.id, action: "TEAM_MEMBER_JOINED" });
  const afterJoin = await prisma.auditLog.count({ where: { projectId: project.id } });
  console.log("1. Log TEAM_MEMBER_JOINED tercatat -> total log:", afterJoin, "(harus 1)");

  // --- Simulasi leaveProjectAction (memberA keluar) ---
  const member = await prisma.teamMember.findFirstOrThrow({ where: { team: { projectId: project.id }, profileId: memberA.id } });
  await prisma.teamMember.update({ where: { id: member.id }, data: { status: "LEFT", leftAt: new Date() } });
  await logAudit({ projectId: project.id, actorId: memberA.id, targetProfileId: memberA.id, action: "TEAM_MEMBER_LEFT" });

  const memberAfterLeave = await prisma.teamMember.findUniqueOrThrow({ where: { id: member.id } });
  const finalLogCount = await prisma.auditLog.count({ where: { projectId: project.id } });
  const activeCount = await prisma.teamMember.count({ where: { team: { projectId: project.id }, status: "ACTIVE" } });
  console.log("2. memberA keluar -> status:", memberAfterLeave.status, "(harus LEFT)");
  console.log("3. Total log setelah leave:", finalLogCount, "(harus 2)");
  console.log("4. Anggota aktif tersisa:", activeCount, "(harus 1 — cuma owner)");

  const ok = afterJoin === 1 && memberAfterLeave.status === "LEFT" && finalLogCount === 2 && activeCount === 1;
  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  await prisma.auditLog.deleteMany({ where: { projectId: project.id } });
  await prisma.teamMember.deleteMany({ where: { team: { projectId: project.id } } });
  await prisma.team.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  console.log("Data uji dihapus.");
}

main()
  .catch((e) => {
    console.error("SMOKE TEST GAGAL:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
