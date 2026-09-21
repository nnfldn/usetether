// QA sementara untuk alur undangan/lamaran (respondInvitationAction dkk).
// Data uji dibuat dan dihapus lagi di akhir. Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-invitation.ts
import { prisma } from "../src/lib/prisma";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";

async function main() {
  const [candidateA, candidateB] = await prisma.profile.findMany({
    where: { id: { not: OWNER_ID } },
    take: 2,
  });
  console.log("Kandidat uji:", candidateA.fullName, "&", candidateB.fullName);

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ownerId: OWNER_ID, title: "__smoketest invite", goal: "uji alur undangan/lamaran", status: "ACTIVE" },
    });
    await tx.team.create({ data: { projectId: p.id, members: { create: { profileId: OWNER_ID, role: "Owner" } } } });
    return p;
  });
  console.log("Proyek uji:", project.id);

  // --- Simulasi inviteCandidateAction (owner -> candidateA) ---
  const invitation = await prisma.teamInvitation.create({
    data: { projectId: project.id, profileId: candidateA.id, direction: "OWNER_INVITED", status: "PENDING" },
  });
  console.log("1. Owner undang candidateA -> invitation", invitation.id, "PENDING");

  // --- Simulasi respondInvitationAction: candidateA menerima ---
  await prisma.$transaction(async (tx) => {
    await tx.teamInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    const team = await tx.team.findUniqueOrThrow({ where: { projectId: project.id } });
    await tx.teamMember.upsert({
      where: { teamId_profileId: { teamId: team.id, profileId: candidateA.id } },
      create: { teamId: team.id, profileId: candidateA.id, role: "Member" },
      update: { status: "ACTIVE", leftAt: null },
    });
  });
  const memberA = await prisma.teamMember.findFirst({ where: { team: { projectId: project.id }, profileId: candidateA.id } });
  console.log("2. candidateA terima -> TeamMember status:", memberA?.status, "(harus ACTIVE)");

  // --- Simulasi applyCandidateAction (candidateB -> owner) ---
  const application = await prisma.teamInvitation.create({
    data: { projectId: project.id, profileId: candidateB.id, direction: "CANDIDATE_APPLIED", status: "PENDING" },
  });
  console.log("3. candidateB melamar -> invitation", application.id, "PENDING");

  // --- Simulasi respondInvitationAction: owner menolak ---
  await prisma.teamInvitation.update({ where: { id: application.id }, data: { status: "DECLINED", respondedAt: new Date() } });
  const memberB = await prisma.teamMember.findFirst({ where: { team: { projectId: project.id }, profileId: candidateB.id } });
  console.log("4. owner tolak -> TeamMember candidateB:", memberB, "(harus null, tidak pernah jadi anggota)");

  const finalMemberCount = await prisma.teamMember.count({ where: { team: { projectId: project.id }, status: "ACTIVE" } });
  console.log("5. Total anggota aktif akhir:", finalMemberCount, "(harus 2: owner + candidateA)");

  if (memberA?.status === "ACTIVE" && memberB === null && finalMemberCount === 2) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  await prisma.teamInvitation.deleteMany({ where: { projectId: project.id } });
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
