"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// Checklist privasi Blueprint Bagian 09: "Ekspor dan hapus akun tersedia
// sejak awal" — ditandai WAJIB sebelum submit, bukan Should-have.
//
// KEPUTUSAN DESAIN PENTING: ini ANONIMISASI, bukan hard-delete baris
// Profile. Alasannya bukan malas — skema saat ini punya banyak relasi
// WAJIB ke Profile tanpa onDelete: Cascade (TeamMember, Milestone.owner,
// Task.assignee, Activity.actor, ProgressUpdate/Comment.author,
// AuditLog) — kalau Profile di-hard-delete, SEMUA riwayat kolaborasi tim
// yang masih relevan buat anggota LAIN akan ikut rusak/gagal (constraint
// violation) atau hilang. Anonimisasi menghapus identitas & data pribadi
// (nama asli, bio, minat, skill, ketersediaan) sekaligus mencabut akses
// login sepenuhnya (akun Supabase Auth benar-benar dihapus) — yang secara
// praktik memenuhi "hapus akun" dari sisi pengguna — TANPA merusak
// integritas riwayat proyek yang masih dipakai tim lain.
export async function deleteAccountAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Anonimisasi Prisma DULU sebelum menghapus akun Supabase Auth —
  // kalau dibalik dan Prisma gagal, data pribadi tetap terbuka tapi user
  // sudah tidak bisa login untuk retry.
  const activeMemberships = await prisma.teamMember.findMany({
    where: {
      profileId: user.id,
      status: "ACTIVE",
      team: { project: { ownerId: { not: user.id } } },
    },
    select: { id: true, team: { select: { projectId: true } } },
  });

  await prisma.$transaction([
    prisma.profileSkill.deleteMany({ where: { profileId: user.id } }),
    prisma.availability.deleteMany({ where: { profileId: user.id } }),
    prisma.profile.update({
      where: { id: user.id },
      data: { fullName: "Pengguna terhapus", bio: null, faculty: null, interests: [] },
    }),
    ...(activeMemberships.length > 0
      ? [
          prisma.teamMember.updateMany({
            where: { id: { in: activeMemberships.map((m) => m.id) } },
            data: { status: "LEFT", leftAt: new Date() },
          }),
        ]
      : []),
  ]);

  for (const membership of activeMemberships) {
    await logAudit({
      projectId: membership.team.projectId,
      actorId: user.id,
      targetProfileId: user.id,
      action: "TEAM_MEMBER_LEFT",
    });
  }

  // Hapus akun Supabase Auth SETELAH data sudah dianonimisasi
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`Gagal menghapus akun: ${error.message}`);

  await supabase.auth.signOut();
  redirect("/sign-in");
}
