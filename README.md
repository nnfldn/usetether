# Tether

Platform pembentukan tim adaptif untuk mahasiswa — menyambung berbagai fase yang biasanya terpisah di aplikasi berbeda (profil, penemuan proyek, pembentukan tim, workspace, dan pemantauan kesehatan proyek) menjadi satu alur, dari Connect sampai Complete.

## Fitur Inti
- **Adaptive Team Formation** — rekomendasi kandidat dihitung ulang setiap komposisi tim berubah, dengan rincian skor dan kalimat penjelasan (bukan kotak hitam).
- **Team Radar** — kebutuhan tim vs cakupan tim divisualisasikan sebagai bentuk (SVG buatan sendiri), bukan daftar.
- **Project Health** — empat indikator (Pulse, Momentum, Balance, Forecast) dihitung harian dari activity log sungguhan, dengan peringatan dini otomatis.

## Stack Teknologi

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 (token warna & komponen MD3 baseline) · Prisma 6 · PostgreSQL via Supabase (Auth + Postgres) · Vercel (hosting + Cron).

## Menjalankan lokal

1. **Environment Variables** — salin `.env.example` menjadi `.env.local` dan isi dengan konfigurasi dari Supabase Dashboard Anda.
2. **Install dependencies** — `pnpm install`
3. **Prisma Client** — `npx prisma generate`
4. **Data Seed (Opsional)** — Menghasilkan data demo kandidat dan proyek untuk pengujian: `pnpm seed`
5. **Jalankan Aplikasi** — `pnpm dev`, buka `http://localhost:3000`

## Pengujian

Aplikasi ini menggunakan Vitest untuk *unit testing* dan Playwright untuk *End-to-End (E2E) testing*.
- `pnpm test` (Menjalankan *unit tests*)
- `pnpm e2e` (Menjalankan E2E testing)
- `pnpm lint` (Pengecekan statis)

## Struktur Direktori

```
src/app/actions/     Server Actions ('use server')
src/app/(app)/       Rute aplikasi yang dilindungi otentikasi
src/app/api/         Route Handler (termasuk Cron Job)
src/lib/matching/    Mesin pencocokan tim (fungsi murni)
src/lib/health/      Mesin kalkulasi kesehatan proyek (fungsi murni)
src/lib/validations/ Skema Zod
src/components/      Komponen UI
prisma/schema.prisma Skema database
prisma/seed.ts       Data dummy/seed
e2e/                 Testing dengan Playwright
scripts/             Script bantuan pengujian / smoke test
```

Otorisasi tingkat objek ditegakkan di lapisan Server Action (`getViewerAccess()`/`isActiveMember()` di `src/lib/team-membership.ts`).