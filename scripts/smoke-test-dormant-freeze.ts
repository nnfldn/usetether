// QA kasus tepi (RENCANA-EKSEKUSI-20-SEP.md item #7): "cron menandai
// DORMANT di tengah masa penjurian — proyek demo tidak boleh terbalik
// statusnya sendiri saat sedang dinilai". Menguji DORMANT_FREEZE_UNTIL
// (src/app/api/cron/health-snapshot/route.ts) dengan mereplikasi PERSIS
// logika penentuan dormant dari route itu, diterapkan hanya ke SATU
// proyek uji sekali pakai — bukan memanggil GET() penuh yang akan
// menyentuh seluruh proyek aktif di data demo (upsert snapshot + kirim
// notifikasi ganda ke akun demo asli). Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-dormant-freeze.ts
import { prisma } from "../src/lib/prisma";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";
const DORMANT_AFTER_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

// Mereplikasi persis dua baris keputusan freeze dari route.ts.
function isDormantFrozen(now: Date, freezeUntilEnv: string | undefined): boolean {
  const dormantFreezeUntil = freezeUntilEnv ? new Date(freezeUntilEnv) : null;
  return dormantFreezeUntil != null && now < dormantFreezeUntil;
}

async function makeStaleProject() {
  const now = new Date();
  return prisma.project.create({
    data: {
      ownerId: OWNER_ID,
      title: "__smoketest dormant-freeze",
      goal: "uji freeze penandaan dormant saat masa penjurian",
      status: "ACTIVE",
      // Proyek "tua" tanpa aktivitas sama sekali -> kandidat DORMANT kalau
      // tidak dibekukan (projectAgeDays >= 21, tidak ada Activity apa pun).
      createdAt: new Date(now.getTime() - (DORMANT_AFTER_DAYS + 5) * DAY_MS),
    },
  });
}

async function runDormantCheck(projectId: string, createdAt: Date, frozen: boolean) {
  const now = new Date();
  const projectAgeDays = (now.getTime() - createdAt.getTime()) / DAY_MS;
  if (!frozen && projectAgeDays >= DORMANT_AFTER_DAYS) {
    const recentActivity = await prisma.activity.findFirst({
      where: { projectId, createdAt: { gte: new Date(now.getTime() - DORMANT_AFTER_DAYS * DAY_MS) } },
      select: { id: true },
    });
    if (!recentActivity) {
      await prisma.project.update({ where: { id: projectId }, data: { status: "DORMANT" } });
    }
  }
}

async function main() {
  // --- Kasus 1: TANPA DORMANT_FREEZE_UNTIL -> proyek tua tanpa aktivitas
  // HARUS jadi DORMANT (perilaku lama, tidak boleh berubah). ---
  const projectA = await makeStaleProject();
  const frozenA = isDormantFrozen(new Date(), undefined);
  await runDormantCheck(projectA.id, projectA.createdAt, frozenA);
  const rereadA = await prisma.project.findUniqueOrThrow({ where: { id: projectA.id } });
  console.log("1. Tanpa freeze — status proyek tua:", rereadA.status, "(harus DORMANT)");

  // --- Kasus 2: DORMANT_FREEZE_UNTIL di masa depan -> proyek tua yang
  // SAMA PERSIS harus TETAP ACTIVE, tidak boleh terbalik sendiri. ---
  const projectB = await makeStaleProject();
  const futureDate = new Date(Date.now() + 10 * DAY_MS).toISOString();
  const frozenB = isDormantFrozen(new Date(), futureDate);
  await runDormantCheck(projectB.id, projectB.createdAt, frozenB);
  const rereadB = await prisma.project.findUniqueOrThrow({ where: { id: projectB.id } });
  console.log("2. Dengan DORMANT_FREEZE_UNTIL di masa depan — status proyek tua:", rereadB.status, "(harus TETAP ACTIVE)");

  // --- Kasus 3: DORMANT_FREEZE_UNTIL sudah LEWAT (mis. penjurian selesai)
  // -> freeze tidak berlaku lagi, proyek tua tetap boleh jadi DORMANT. ---
  const projectC = await makeStaleProject();
  const pastDate = new Date(Date.now() - 10 * DAY_MS).toISOString();
  const frozenC = isDormantFrozen(new Date(), pastDate);
  await runDormantCheck(projectC.id, projectC.createdAt, frozenC);
  const rereadC = await prisma.project.findUniqueOrThrow({ where: { id: projectC.id } });
  console.log("3. Dengan DORMANT_FREEZE_UNTIL yang sudah lewat — status proyek tua:", rereadC.status, "(harus DORMANT lagi)");

  const ok = rereadA.status === "DORMANT" && rereadB.status === "ACTIVE" && rereadC.status === "DORMANT";
  if (ok) {
    console.log("\nSEMUA ASERSI LOLOS.");
  } else {
    console.error("\nADA ASERSI GAGAL — cek output di atas.");
    process.exitCode = 1;
  }

  await prisma.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id, projectC.id] } } });
  console.log("Data uji dihapus.");
}

main()
  .catch((e) => {
    console.error("SMOKE TEST GAGAL:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
