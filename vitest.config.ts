import { defineConfig } from "vitest/config";

/**
 * Memisahkan dua jenis test yang TIDAK boleh dijalankan runner yang sama:
 *
 *   pnpm test  -> vitest, unit test logika murni. Cepat, tanpa database,
 *                 tanpa browser. Inilah yang berjalan di CI.
 *   pnpm e2e   -> Playwright, alur lewat browser. Butuh database berisi
 *                 data seed, jadi TIDAK berjalan di CI.
 *
 * Tanpa `exclude` di bawah, vitest ikut memungut e2e/*.spec.ts (pola
 * bawaannya mencakup .spec.ts) lalu gagal dengan "Playwright Test did not
 * expect test.describe() to be called here" — dan itu membuat `pnpm test`
 * merah karena alasan yang tidak ada hubungannya dengan kode aplikasi.
 */
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "e2e/**"],
  },
});
