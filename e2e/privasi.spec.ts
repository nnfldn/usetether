import { test, expect } from "@playwright/test";
import { login, logout, bukaProyek, AKUN, PROYEK } from "./helpers";

/**
 * Gerbang privasi proyek.
 *
 * Ini BUKAN test hipotetis: 31 Agustus 2026 ditemukan bahwa halaman Tim,
 * Ruang Kerja, dan dashboard kesehatan ter-render ke SIAPA PUN yang login,
 * bukan cuma anggota tim. Sudah diperbaiki lewat getViewerAccess(), tapi
 * perbaikan tanpa test adalah perbaikan yang menunggu dibatalkan diam-diam
 * oleh perubahan berikutnya — apalagi selama tiga orang menyunting halaman
 * yang sama sampai 20 September.
 *
 * Ini juga persis hal yang paling mungkin dicoba juri: menempel URL tim
 * orang lain di address bar.
 */
test.describe("Gerbang privasi proyek", () => {
  test("non-anggota ditolak di Tim, Ruang Kerja, dan dashboard kesehatan", async ({
    page,
  }) => {
    // 1. Sebagai ANGGOTA — catat ID proyek dan pastikan datanya memang ada.
    await login(page, AKUN.anggotaProyekSehat);
    const projectId = await bukaProyek(page, PROYEK.sehat);

    await page.goto(`/projects/${projectId}/team`);
    await expect(page.getByText("Anggota tim")).toBeVisible();
    await expect(page.getByText("Peringkat kandidat")).toBeVisible();

    await logout(page);

    // 2. Sebagai BUKAN anggota — URL yang sama persis harus tertutup.
    await login(page, AKUN.bukanAnggota);

    const privat = "Konten ini privat untuk anggota tim proyek ini.";

    await page.goto(`/projects/${projectId}/team`);
    await expect(page.getByText(privat)).toBeVisible();
    // Bukan cuma "pesan privat muncul" — pastikan datanya benar-benar TIDAK
    // ikut ter-render. Halaman bisa saja menampilkan keduanya sekaligus.
    await expect(page.getByText("Peringkat kandidat")).toHaveCount(0);
    await expect(page.getByText("Team Radar")).toHaveCount(0);

    await page.goto(`/projects/${projectId}/workspace`);
    await expect(page.getByText(privat)).toBeVisible();

    // 3. Halaman ringkasan: metadata proyek memang SENGAJA publik (penemuan
    //    proyek), tapi dashboard kesehatan tidak boleh ikut.
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("heading", { name: PROYEK.sehat })).toBeVisible();
    await expect(page.getByText("Kebutuhan skill tim")).toBeVisible();
    await expect(page.getByText("Kesehatan proyek")).toHaveCount(0);
  });

  test("pengunjung tanpa login diarahkan ke halaman masuk", async ({ page }) => {
    // proxy.ts (dulu middleware.ts) yang menegakkan ini. Rename konvensi
    // Next 16 sempat menyentuh berkas itu — test ini menjaganya.
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
