// QA sementara untuk Ruang Diskusi (schema.prisma model Comment,
// actions/discussion.ts postCommentAction). Data uji dibuat dan dihapus
// lagi di akhir. Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-discussion.ts
import { prisma } from "../src/lib/prisma";
import { logThrottledActivity } from "../src/lib/activity";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";

async function main() {
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ownerId: OWNER_ID, title: "__smoketest discussion", goal: "uji fitur ruang diskusi", status: "ACTIVE" },
    });
    await tx.team.create({ data: { projectId: p.id, members: { create: { profileId: OWNER_ID, role: "Owner" } } } });
    return p;
  });
  console.log("Proyek uji:", project.id);

  await prisma.discussionPost.create({ data: { projectId: project.id, authorId: OWNER_ID, body: "Komentar pertama." } });
  const firstLogged = await logThrottledActivity({ projectId: project.id, actorId: OWNER_ID, eventType: "DISKUSI_BERMAKNA" });
  console.log("1. Komentar pertama -> Activity dicatat:", firstLogged, "(harus true)");

  await prisma.discussionPost.create({ data: { projectId: project.id, authorId: OWNER_ID, body: "Komentar kedua, masih dalam cooldown." } });
  const secondLogged = await logThrottledActivity({ projectId: project.id, actorId: OWNER_ID, eventType: "DISKUSI_BERMAKNA" });
  console.log("2. Komentar kedua -> Activity dicatat:", secondLogged, "(harus false, cooldown aktif)");

  const commentCount = await prisma.discussionPost.count({ where: { projectId: project.id } });
  const activityCount = await prisma.activity.count({ where: { projectId: project.id, eventType: "DISKUSI_BERMAKNA" } });
  console.log("3. Total Comment tersimpan:", commentCount, "(harus 2 — teks TIDAK pernah dibuang)");
  console.log("4. Total Activity(DISKUSI_BERMAKNA) tercatat:", activityCount, "(harus 1 — cooldown menahan yang kedua)");

  const ok = firstLogged === true && secondLogged === false && commentCount === 2 && activityCount === 1;
  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  await prisma.activity.deleteMany({ where: { projectId: project.id } });
  await prisma.discussionPost.deleteMany({ where: { projectId: project.id } });
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
