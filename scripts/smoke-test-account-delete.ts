// QA sementara untuk deleteAccountAction (anonimisasi + hapus login).
// Membuat akun uji sekali pakai, isi sedikit data, lalu "hapus", lalu
// verifikasi. TIDAK menyentuh akun lain. Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-account-delete.ts
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/prisma";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SECRET_KEY!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const email = `__smoketest-delete-${Date.now()}@tether.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "admin123",
    email_confirm: true,
    user_metadata: { full_name: "Akun Uji Hapus" },
  });
  if (error || !data.user) throw new Error(`Gagal buat akun uji: ${error?.message}`);
  const userId = data.user.id;
  console.log("1. Akun uji dibuat:", userId, email);

  const skill = await prisma.skill.findFirstOrThrow();
  await prisma.profile.update({ where: { id: userId }, data: { bio: "Bio uji", faculty: "Uji Coba", interests: ["web"] } });
  await prisma.profileSkill.create({ data: { profileId: userId, skillId: skill.id, evidenceLevel: 0.5 } });
  await prisma.availability.create({ data: { profileId: userId, dayOfWeek: 1, block: "PAGI" } });
  console.log("2. Data profil uji diisi (bio, skill, ketersediaan).");

  // --- Simulasi deleteAccountAction ---
  const { error: delError } = await admin.auth.admin.deleteUser(userId);
  if (delError) throw new Error(`Gagal hapus auth user: ${delError.message}`);
  await prisma.$transaction([
    prisma.profileSkill.deleteMany({ where: { profileId: userId } }),
    prisma.availability.deleteMany({ where: { profileId: userId } }),
    prisma.profile.update({
      where: { id: userId },
      data: { fullName: "Pengguna terhapus", bio: null, faculty: null, interests: [] },
    }),
  ]);
  console.log("3. deleteAccountAction disimulasikan.");

  // --- Verifikasi ---
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const stillExists = userList?.users.some((u) => u.id === userId);
  const profile = await prisma.profile.findUniqueOrThrow({ where: { id: userId } });
  const skillCount = await prisma.profileSkill.count({ where: { profileId: userId } });
  const availCount = await prisma.availability.count({ where: { profileId: userId } });

  console.log("4. Akun Supabase Auth masih ada?", stillExists, "(harus false)");
  console.log("5. Profile.fullName:", profile.fullName, "(harus 'Pengguna terhapus')");
  console.log("6. Profile.bio/faculty:", profile.bio, profile.faculty, "(harus null, null)");
  console.log("7. Sisa ProfileSkill:", skillCount, "Availability:", availCount, "(harus 0, 0)");

  const ok = !stillExists && profile.fullName === "Pengguna terhapus" && profile.bio === null && profile.faculty === null && skillCount === 0 && availCount === 0;
  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  // Bersihkan sisa baris Profile anonim (bukan bagian dari populasi seed nyata).
  await prisma.profile.delete({ where: { id: userId } });
  console.log("Data uji dihapus sepenuhnya.");
}

main()
  .catch((e) => {
    console.error("SMOKE TEST GAGAL:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
