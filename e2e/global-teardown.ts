import { execFileSync } from "node:child_process";

/**
 * Menghapus proyek buatan E2E setelah seluruh test selesai.
 *
 * Dijalankan sebagai PROSES TERPISAH lewat tsx, bukan impor langsung:
 * Prisma Client memakai `import.meta` (ESM) sedangkan Playwright
 * mentranspilasi berkas konfigurasinya ke CJS — mengimpor Prisma di sini
 * membuat seluruh test gagal dimuat dengan "Cannot use 'import.meta'
 * outside a module".
 *
 * E2E berjalan di database yang SAMA dengan data demo, jadi pembersihan
 * ini bukan kemewahan: tanpa itu proyek sampah menumpuk di halaman
 * penemuan proyek dan akhirnya terlihat juri.
 */
export default function globalTeardown() {
  execFileSync("pnpm", ["tsx", "--env-file=.env", "scripts/cleanup-e2e.ts"], {
    stdio: "inherit",
  });
}
