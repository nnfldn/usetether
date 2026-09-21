import { defineConfig, devices } from "@playwright/test";

/**
 * E2E Tether — menutup celah verifikasi yang tidak bisa ditutup unit test.
 *
 * 65 unit test menguji logika murni, 10 smoke test menguji operasi database,
 * tapi TIDAK SATU PUN memanggil Server Action lewat jalur yang dipakai
 * pengguna. Bug "nama field form tidak cocok dengan formData.get()" lolos
 * dari build, lint, dan seluruh test — gejalanya tombol diklik juri dan
 * tidak terjadi apa-apa. Berkas-berkas di e2e/ menutup persis celah itu.
 *
 * ⚠️ SENGAJA TIDAK DIJALANKAN DI CI. Test ini butuh database sungguhan
 * berisi data seed, sedangkan CI sengaja berjalan tanpa kredensial apa pun
 * (lihat .github/workflows/ci.yml). Jalankan lokal:
 *   pnpm e2e            (headless)
 *   pnpm e2e:ui         (mode berbantuan, untuk menelusuri kegagalan)
 */
export default defineConfig({
  testDir: "./e2e",
  // Menghapus proyek bertanda __e2e setelah seluruh test selesai. E2E ini
  // berjalan di database yang SAMA dengan data demo, jadi pembersihan bukan
  // kemewahan — tanpa ini, proyek sampah menumpuk dan akhirnya terlihat juri.
  globalTeardown: "./e2e/global-teardown.ts",
  // Berurutan, bukan paralel: seluruh test memakai SATU database bersama
  // yang sama dengan dev. Dua test yang menulis bersamaan akan saling
  // merusak data dengan cara yang sulit dilacak.
  fullyParallel: false,
  workers: 1,
  // Jangan biarkan test yang gagal karena data kotor terlihat "lulus"
  // setelah diulang — kegagalan di sini harus ditelusuri, bukan disembunyikan.
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        // PENTING: memakai Google Chrome yang SUDAH TERPASANG di mesin,
        // bukan Chromium bawaan Playwright. Unduhan Chromium-nya gagal di
        // jaringan ini (4 Sep 2026, "Download failure, code=1"), dan tidak
        // perlu diulang — baris ini membuatnya tidak dibutuhkan sama sekali.
        channel: "chrome",
      },
    },
  ],

  // Pakai dev server yang sudah jalan kalau ada; kalau tidak, nyalakan.
  // Sengaja `pnpm dev`, bukan build+start: test ini alat pengembangan
  // sehari-hari, bukan gerbang rilis.
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
