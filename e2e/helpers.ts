import { expect, type Page } from "@playwright/test";

/** Semua akun seed memakai sandi yang sama — lihat bagitugas/AKUN-DEMO.md. */
export const SANDI = "admin123";

/**
 * Login lewat form sungguhan, bukan menyuntik cookie.
 *
 * Disengaja: menyuntik sesi akan melewati justru bagian yang paling ingin
 * diuji — bahwa form sign-in benar-benar terhubung ke signInAction dan
 * proxy.ts benar-benar menyegarkan sesi Supabase.
 */
export async function login(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  // Login sukses selalu mendarat di halaman ber-navigasi. Menunggu tombol
  // "Keluar" muncul lebih andal daripada menunggu URL tertentu, karena
  // tujuan redirect bisa berubah.
  await expect(tombolKeluar(page)).toBeVisible();
}

/**
 * exact:true WAJIB di sini. Pencocokan nama Playwright memakai substring,
 * jadi "Keluar" juga cocok dengan tombol "Keluar dari proyek ini" di
 * halaman Tim. Playwright menolak ambiguitas itu (strict mode) — dan itu
 * menyelamatkan: tanpa pagar tersebut, test ini bisa diam-diam
 * mengeluarkan anggota dari proyek demo alih-alih logout.
 */
function tombolKeluar(page: Page) {
  return page.getByRole("button", { name: "Keluar", exact: true });
}

export async function logout(page: Page) {
  await tombolKeluar(page).click();
  await expect(page.getByRole("button", { name: "Masuk", exact: true })).toBeVisible();
}

/**
 * Rate limit login: 5x per 5 menit per (IP + email). Menjalankan banyak
 * test yang masing-masing login akan menabraknya dan membuat test gagal
 * karena alasan yang sama sekali tidak berhubungan dengan yang diuji.
 * Karena itu tiap berkas test memakai akun yang BERBEDA sebisa mungkin,
 * dan jumlah login per akun dijaga tetap sedikit.
 */
export const AKUN = {
  anggotaProyekSehat: "putri.aditya@tether.test",
  bukanAnggota: "eka.gunawan@tether.test",
  anggotaProyekSelesai: "nadia.nugroho@tether.test",
  punyaUndangan: "jihan.iskandar@tether.test",
} as const;

/** Judul proyek seed — konstan lintas run seed (prisma/seed.ts). */
export const PROYEK = {
  sehat: "Peta Ruang Terbuka Hijau Kampus",
  berisiko: "Sistem Antrian Klinik Kampus",
  selesai: "Aplikasi Booking Ruang Belajar",
  dormant: "Komunitas Riset Iklim Kampus",
} as const;

/**
 * Buka proyek lewat halaman penemuan, lalu kembalikan ID-nya dari URL.
 *
 * Sengaja lewat UI, bukan query database: ID proyek berganti tiap kali
 * `pnpm seed` dijalankan, dan menempuh jalur ini sekalian membuktikan
 * halaman penemuan benar-benar menautkan ke proyek yang benar.
 */
export async function bukaProyek(page: Page, judul: string): Promise<string> {
  await page.goto("/projects");
  await page.getByRole("link", { name: new RegExp(judul, "i") }).first().click();
  // Menunggu URL, BUKAN menunggu judulnya muncul. Judul yang sama juga ada
  // di kartu halaman daftar, jadi assertion teks langsung lolos tanpa
  // menunggu navigasi selesai — dan ID dibaca dari URL yang masih /projects.
  // Persis jebakan itu yang membuat test ini gagal saat pertama ditulis.
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  expect(id, `ID proyek "${judul}" tidak terbaca dari URL`).toBeTruthy();
  return id;
}
