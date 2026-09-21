// QA sementara untuk penanda kedua task (anti-gaming Bagian 08):
// confirmTaskAction di actions/workspace.ts. Data uji dibuat dan dihapus
// lagi di akhir. Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-task-confirm.ts
import { prisma } from "../src/lib/prisma";
import { logActivity } from "../src/lib/activity";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";

async function main() {
  const [member] = await prisma.profile.findMany({ where: { id: { not: OWNER_ID } }, take: 1 });
  console.log("Anggota uji (assignee):", member.fullName);

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ownerId: OWNER_ID, title: "__smoketest task-confirm", goal: "uji penanda kedua task", status: "ACTIVE" },
    });
    await tx.team.create({
      data: { projectId: p.id, members: { create: [{ profileId: OWNER_ID, role: "Owner" }, { profileId: member.id, role: "Member" }] } },
    });
    return p;
  });
  const milestone = await prisma.milestone.create({
    data: { projectId: project.id, ownerId: OWNER_ID, title: "M uji", deadline: new Date(Date.now() + 7 * 86_400_000), weight: 1 },
  });
  const task = await prisma.task.create({
    data: { milestoneId: milestone.id, title: "Task uji", weight: 1, assigneeId: member.id, status: "TODO" },
  });
  console.log("Proyek/milestone/task uji dibuat:", project.id);

  // --- 1. Assignee (bukan owner) tandai PENDING_CONFIRM sendiri -- ini sah, ini "penanda pertama" ---
  await prisma.task.update({ where: { id: task.id }, data: { status: "PENDING_CONFIRM" } });
  const afterMark = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
  console.log("1. Assignee tandai PENDING_CONFIRM -> status:", afterMark.status, "(harus PENDING_CONFIRM)");

  // --- 2. Simulasi confirmTaskAction TAPI oleh assignee sendiri (harus DITOLAK -- assignee bukan owner/milestone-owner) ---
  const isAssigneeAuthorized = member.id === project.ownerId || member.id === milestone.ownerId;
  console.log("2. Apakah assignee berwenang konfirmasi sendiri?", isAssigneeAuthorized, "(harus false)");

  // --- 3. Simulasi confirmTaskAction oleh OWNER (harus DITERIMA -- ini "penanda kedua") ---
  const isOwnerAuthorized = OWNER_ID === project.ownerId || OWNER_ID === milestone.ownerId;
  console.log("3. Apakah owner berwenang konfirmasi?", isOwnerAuthorized, "(harus true)");

  const activityCountBefore = await prisma.activity.count({ where: { projectId: project.id, eventType: "TASK_SELESAI" } });
  await prisma.task.update({ where: { id: task.id }, data: { status: "DONE" } });
  await logActivity({ projectId: project.id, actorId: OWNER_ID, eventType: "TASK_SELESAI" });
  const activityCountAfter = await prisma.activity.count({ where: { projectId: project.id, eventType: "TASK_SELESAI" } });
  const finalTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });

  console.log("4. Task setelah dikonfirmasi owner -> status:", finalTask.status, "(harus DONE)");
  console.log("5. Activity TASK_SELESAI sebelum/sesudah konfirmasi:", activityCountBefore, "->", activityCountAfter, "(harus 0 -> 1, BUKAN dicatat saat langkah 1)");

  const ok =
    afterMark.status === "PENDING_CONFIRM" &&
    isAssigneeAuthorized === false &&
    isOwnerAuthorized === true &&
    finalTask.status === "DONE" &&
    activityCountBefore === 0 &&
    activityCountAfter === 1;

  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  await prisma.activity.deleteMany({ where: { projectId: project.id } });
  await prisma.task.deleteMany({ where: { milestoneId: milestone.id } });
  await prisma.milestone.deleteMany({ where: { projectId: project.id } });
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
