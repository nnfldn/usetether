// QA sementara untuk fitur Progress Update (schema.prisma model
// ProgressUpdate, logThrottledActivity di src/lib/activity.ts). Data uji
// dibuat dan dihapus lagi di akhir. Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-progress-update.ts
import { prisma } from "../src/lib/prisma";
import { logThrottledActivity } from "../src/lib/activity";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";

async function main() {
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ownerId: OWNER_ID, title: "__smoketest progress-update", goal: "uji fitur progress update", status: "ACTIVE" },
    });
    await tx.team.create({ data: { projectId: p.id, members: { create: { profileId: OWNER_ID, role: "Owner" } } } });
    return p;
  });
  console.log("Proyek uji:", project.id);

  // --- 1. Posting update pertama: harus tersimpan DAN memicu Activity ---
  await prisma.progressUpdate.create({ data: { projectId: project.id, authorId: OWNER_ID, body: "Update pertama." } });
  const firstLogged = await logThrottledActivity({ projectId: project.id, actorId: OWNER_ID, eventType: "PROGRESS_UPDATE" });
  console.log("1. Update pertama -> Activity dicatat:", firstLogged, "(harus true)");

  // --- 2. Posting update kedua langsung sesudahnya (masih dalam cooldown 1 jam) ---
  await prisma.progressUpdate.create({ data: { projectId: project.id, authorId: OWNER_ID, body: "Update kedua, masih dalam cooldown." } });
  const secondLogged = await logThrottledActivity({ projectId: project.id, actorId: OWNER_ID, eventType: "PROGRESS_UPDATE" });
  console.log("2. Update kedua -> Activity dicatat:", secondLogged, "(harus false, cooldown aktif)");

  const updateCount = await prisma.progressUpdate.count({ where: { projectId: project.id } });
  const activityCount = await prisma.activity.count({ where: { projectId: project.id, eventType: "PROGRESS_UPDATE" } });
  console.log("3. Total ProgressUpdate tersimpan:", updateCount, "(harus 2 — teks TIDAK pernah dibuang)");
  console.log("4. Total Activity(PROGRESS_UPDATE) tercatat:", activityCount, "(harus 1 — cooldown menahan yang kedua)");

  // --- 3. Cooldown yang sudah kedaluwarsa (simulasi lewat cooldownMs=0) harus tetap mencatat ---
  const thirdLogged = await logThrottledActivity({
    projectId: project.id,
    actorId: OWNER_ID,
    eventType: "PROGRESS_UPDATE",
    cooldownMs: 0,
  });
  console.log("5. Cooldown 0ms (simulasi sudah lewat 1 jam) -> Activity dicatat:", thirdLogged, "(harus true)");

  const ok = firstLogged === true && secondLogged === false && updateCount === 2 && activityCount === 1 && thirdLogged === true;
  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  await prisma.activity.deleteMany({ where: { projectId: project.id } });
  await prisma.progressUpdate.deleteMany({ where: { projectId: project.id } });
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
