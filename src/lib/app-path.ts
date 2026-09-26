// basePath (NEXT_BASE_PATH=/app di produksi) tidak boleh ditambahkan manual ke
// redirect(): Next.js sudah melakukannya sendiri untuk Server Component,
// Route Handler, dan router di browser. Menambahkan lagi justru menghasilkan
// /app/app/... — terverifikasi lokal 25 September: redirect() di root /app
// mendarat di /app/app/sign-in.
//
// Pengukuran lengkap di produksi dan lokal (Next 16):
//
//   - Server Component  : redirect("/work") -> /app/work        (otomatis)
//   - Router di browser : router.push("/work") -> /app/work     (otomatis)
//   - Middleware         : NextResponse.redirect dengan pathname polos, tanpa
//                          basePath manual -> /app/sign-in     (otomatis)
//   - Server Action      : TIDAK konsisten. Form di halaman dinamis dijawab
//                          payload RSC 200 lalu dipindah router browser
//                          (otomatis); form di halaman statis dijawab 303
//                          dengan Location apa adanya (basePath hilang) ->
//                          auth actions yang form-nya di halaman statis
//                          mengembalikan redirectTo, bukan redirect().
//                          Lihat AuthActionState.redirectTo di actions/auth.ts.
//
// Jadi file ini hanya menyisakan appPath(): untuk URL absolut yang dirakit
// sendiri di dalam kode, yaitu link tujuan email reset sandi di
// src/app/auth/confirm/route.ts yang tidak melewati redirect() sama sekali.
export function appPath(path: string): string {
  return `${process.env.NEXT_BASE_PATH ?? ""}${path}`;
}
