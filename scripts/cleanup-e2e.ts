// Menghapus proyek sisa test E2E. Dipanggil otomatis oleh global-teardown
// Playwright, bisa juga dijalankan manual kalau ada test yang terhenti:
// pnpm tsx --env-file=.env scripts/cleanup-e2e.ts
import { prisma } from "../src/lib/prisma";
import { PENANDA_E2E } from "../e2e/konstanta";

async function main() {
  const sampah = await prisma.project.findMany({
    where: { title: { startsWith: PENANDA_E2E } },
    select: { id: true },
  });
  if (sampah.length === 0) {
    console.log("[cleanup-e2e] tidak ada proyek E2E tersisa.");
    return;
  }
  // Relasi proyek (team, milestone, task, komentar, aktivitas, peer rating)
  // ikut terhapus lewat cascade.
  await prisma.project.deleteMany({ where: { id: { in: sampah.map((p) => p.id) } } });
  console.log(`[cleanup-e2e] ${sampah.length} proyek E2E dihapus.`);
}

main().finally(() => prisma.$disconnect());
