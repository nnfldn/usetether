/**
 * Penanda judul proyek buatan E2E.
 *
 * Sengaja dipisah ke berkas sendiri TANPA impor apa pun: berkas ini dipakai
 * bersama oleh spec (dijalankan Playwright, transpilasi CJS) dan skrip
 * pembersih (dijalankan tsx). Prisma Client memakai `import.meta` sehingga
 * tidak bisa masuk ke graf modul Playwright — kalau konstanta ini ikut
 * berada di berkas yang mengimpor Prisma, seluruh spec gagal dimuat.
 */
export const PENANDA_E2E = "__e2e";
