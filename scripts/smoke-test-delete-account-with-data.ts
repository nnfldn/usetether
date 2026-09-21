// QA kasus tepi (RENCANA-EKSEKUSI-20-SEP.md item #7): "hapus akun anggota
// yang punya task, komentar, dan aktivitas — halaman tim/workspace tim lain
// tidak boleh rusak, cuma berubah jadi 'Pengguna terhapus'".
//
// Akun uji dibuat KHUSUS untuk skrip ini lewat Supabase Auth Admin API
// (bukan akun demo asli) supaya deleteAccountAction sungguhan (yang
// menghapus akun Supabase Auth secara permanen) aman dijalankan penuh,
// bukan cuma disimulasikan sebagian seperti smoke test lain. Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-delete-account-with-data.ts
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/prisma";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";
const TEST_EMAIL = `__smoketest-delete-${Date.now()}@tether.test`;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SECRET_KEY!;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY belum ada di .env");
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const [otherMember] = await prisma.profile.findMany({ where: { id: { not: OWNER_ID } }, take: 1 });

  // --- Buat akun uji sekali pakai lewat Auth Admin API (memicu trigger
  // on_auth_user_created -> baris Profile otomatis dibuat, lihat migrasi
  // 20260829093746_auth_profile_sync_trigger). ---
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: "smoketest-throwaway-pw",
    email_confirm: true,
    user_metadata: { full_name: "__Smoketest Leaving User" },
  });
  if (createError || !created.user) throw new Error(`Gagal buat akun uji: ${createError?.message}`);
  const leavingUserId = created.user.id;
  console.log("0. Akun uji dibuat:", TEST_EMAIL, leavingUserId);

  // Trigger DB berjalan sinkron di dalam INSERT auth.users, tapi beri jeda
  // kecil untuk jaga-jaga replikasi sebelum Prisma membaca baris profiles.
  let profile = await prisma.profile.findUnique({ where: { id: leavingUserId } });
  for (let i = 0; i < 10 && !profile; i++) {
    await new Promise((r) => setTimeout(r, 300));
    profile = await prisma.profile.findUnique({ where: { id: leavingUserId } });
  }
  if (!profile) throw new Error("Trigger on_auth_user_created tidak membuat baris Profile — cek migrasi.");

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { ownerId: OWNER_ID, title: "__smoketest delete-account-with-data", goal: "uji hapus akun anggota yang punya data", status: "ACTIVE" },
    });
    await tx.team.create({
      data: {
        projectId: p.id,
        members: {
          create: [
            { profileId: OWNER_ID, role: "Owner" },
            { profileId: leavingUserId, role: "Member" },
            { profileId: otherMember.id, role: "Member" },
          ],
        },
      },
    });
    return p;
  });
  console.log("1. Proyek uji:", project.id);

  const milestone = await prisma.milestone.create({
    data: { projectId: project.id, ownerId: leavingUserId, title: "__smoketest milestone", deadline: new Date() },
  });
  const task = await prisma.task.create({
    data: { milestoneId: milestone.id, title: "__smoketest task", assigneeId: leavingUserId },
  });
  const comment = await prisma.discussionPost.create({
    data: { projectId: project.id, authorId: leavingUserId, body: "__smoketest komentar dari anggota yang akan hapus akun" },
  });
  const update = await prisma.progressUpdate.create({
    data: { projectId: project.id, authorId: leavingUserId, body: "__smoketest progress update" },
  });
  const activity = await prisma.activity.create({
    data: { projectId: project.id, actorId: leavingUserId, eventType: "DISKUSI_BERMAKNA", weight: 1 },
  });
  await prisma.auditLog.create({
    data: { projectId: project.id, actorId: leavingUserId, targetProfileId: leavingUserId, action: "TEAM_MEMBER_JOINED" },
  });
  console.log("2. Milestone, task, komentar, progress update, activity, audit log dibuat atas nama akun uji.");

  // --- Jalankan PERSIS logika deleteAccountAction (account.ts) ---
  const { error: deleteError } = await admin.auth.admin.deleteUser(leavingUserId);
  if (deleteError) throw new Error(`Gagal menghapus akun uji: ${deleteError.message}`);
  const activeMemberships = await prisma.teamMember.findMany({
    where: { profileId: leavingUserId, status: "ACTIVE", team: { project: { ownerId: { not: leavingUserId } } } },
    select: { id: true, team: { select: { projectId: true } } },
  });
  await prisma.$transaction([
    prisma.profileSkill.deleteMany({ where: { profileId: leavingUserId } }),
    prisma.availability.deleteMany({ where: { profileId: leavingUserId } }),
    prisma.profile.update({
      where: { id: leavingUserId },
      data: { fullName: "Pengguna terhapus", bio: null, faculty: null, interests: [] },
    }),
    prisma.teamMember.updateMany({
      where: { id: { in: activeMemberships.map((m) => m.id) } },
      data: { status: "LEFT", leftAt: new Date() },
    }),
  ]);
  for (const m of activeMemberships) {
    await prisma.auditLog.create({
      data: { projectId: m.team.projectId, actorId: leavingUserId, targetProfileId: leavingUserId, action: "TEAM_MEMBER_LEFT" },
    });
  }
  console.log("3. Akun uji dihapus lewat deleteAccountAction (Auth dicabut + Profile dianonimkan + TeamMember jadi LEFT).");

  // --- Baca ulang PERSIS bentuk query yang dipakai team/page.tsx,
  // workspace/page.tsx, dan project/page.tsx, pastikan tidak crash dan
  // menampilkan "Pengguna terhapus". ---
  const [activeTeamMembers, deletedMemberRow, milestoneReread, taskReread, commentReread, updateReread, activityReread, auditReread] =
    await Promise.all([
      prisma.teamMember.findMany({
        where: { team: { projectId: project.id }, status: "ACTIVE" },
        include: { profile: true },
      }),
      prisma.teamMember.findFirst({ where: { team: { projectId: project.id }, profileId: leavingUserId } }),
      prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id }, include: { owner: true } }),
      prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { assignee: true } }),
      prisma.discussionPost.findUniqueOrThrow({ where: { id: comment.id }, include: { author: true } }),
      prisma.progressUpdate.findUniqueOrThrow({ where: { id: update.id }, include: { author: true } }),
      prisma.activity.findUniqueOrThrow({ where: { id: activity.id }, include: { actor: true } }),
      prisma.auditLog.findMany({ where: { projectId: project.id }, include: { actor: true, targetProfile: true }, orderBy: { createdAt: "asc" } }),
    ]);

  const stillCountedActive = activeTeamMembers.some((m) => m.profileId === leavingUserId);
  console.log("4. Akun terhapus masih dihitung ACTIVE di 'Anggota tim'?", stillCountedActive, "(harus false)");
  console.log("4b. Status TeamMember akun terhapus:", deletedMemberRow?.status, "(harus LEFT)");
  console.log("5. Milestone.owner.fullName:", milestoneReread.owner.fullName);
  console.log("6. Task.assignee.fullName:", taskReread.assignee?.fullName);
  console.log("7. Comment.author.fullName:", commentReread.author.fullName, "| body tetap tersimpan:", commentReread.body.startsWith("__smoketest"));
  console.log("8. ProgressUpdate.author.fullName:", updateReread.author.fullName);
  console.log("9. Activity.actor.fullName:", activityReread.actor.fullName);
  console.log(
    "10. Audit log proyek (harus 2: TEAM_MEMBER_JOINED simulasi + TEAM_MEMBER_LEFT dari penghapusan akun):",
    auditReread.map((a) => `${a.action} (${a.actor.fullName} -> ${a.targetProfile.fullName})`),
  );

  const expectedName = "Pengguna terhapus";
  const ok =
    !stillCountedActive &&
    deletedMemberRow?.status === "LEFT" &&
    milestoneReread.owner.fullName === expectedName &&
    taskReread.assignee?.fullName === expectedName &&
    commentReread.author.fullName === expectedName &&
    updateReread.author.fullName === expectedName &&
    activityReread.actor.fullName === expectedName &&
    auditReread.length === 2 &&
    auditReread.every((a) => a.actor.fullName === expectedName && a.targetProfile.fullName === expectedName) &&
    auditReread[1].action === "TEAM_MEMBER_LEFT";

  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS — tidak ada query yang crash, semua tampil 'Pengguna terhapus'.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  // Cascade dari Project menghapus Team/TeamMember/Milestone/Task/Activity/
  // ProgressUpdate/Comment/AuditLog sekaligus (lihat onDelete: Cascade di
  // schema.prisma). Profile akun uji dihapus terakhir karena baru bebas FK
  // setelah itu.
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.profile.delete({ where: { id: leavingUserId } });
  console.log("Data uji dihapus (akun Supabase Auth uji sudah tercabut sejak langkah 3, sesuai desain fitur).");
}

main()
  .catch((e) => {
    console.error("SMOKE TEST GAGAL:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
