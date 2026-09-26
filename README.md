# Tether

Platform pembentukan tim adaptif untuk mahasiswa — menyambung tujuh fase yang biasanya terpisah di lima aplikasi berbeda (profil, penemuan proyek, pembentukan tim, workspace, dan pemantauan kesehatan proyek) jadi satu alur, dari Connect sampai Complete.

Tiga inovasi inti:
- **Adaptive Team Formation** — rekomendasi kandidat dihitung ulang setiap komposisi tim berubah, dengan rincian skor dan kalimat penjelasan (bukan kotak hitam).
- **Team Radar** — kebutuhan tim vs cakupan tim divisualisasikan sebagai bentuk (SVG buatan sendiri), bukan daftar.
- **Project Health** — empat indikator (Pulse, Momentum, Balance, Forecast) dihitung harian dari activity log sungguhan, dengan peringatan dini otomatis.

Dibangun untuk kompetisi hackathon/lomba (lihat `TENGGAT.md` untuk tenggat, `RENCANA-BESAR.md` untuk rencana kerja lengkap). Dokumen produk sumber (Blueprint & Rencana Implementasi) ada di luar repo ini.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 (token warna & komponen MD3 baseline, lihat `src/app/globals.css`) · Prisma 6 · PostgreSQL via Supabase (Auth + Postgres) · Vercel (hosting + Cron).

## Menjalankan lokal

1. **Env var** — salin `.env.example` jadi `.env`, isi dengan nilai dari Supabase Dashboard (Project Settings → API & Database). Minta file `.env` yang sudah terisi ke pemilik project lewat channel aman kalau kamu bukan yang menyiapkan Supabase-nya.
2. **Install** — `pnpm install`
3. **Prisma Client** — `npx prisma generate` (wajib tiap kali `prisma/schema.prisma` berubah — kalau lupa, error tipe yang membingungkan saat build)
4. **Data demo** — `pnpm seed` (50 akun kandidat `@tether.test`/`admin123` + 5 proyek skenario yang menyentuh semua fitur must-have; aman dijalankan ulang kapan saja, lihat komentar di `prisma/seed.ts`)
5. **Jalankan** — `pnpm dev`, buka `http://localhost:3000`, login pakai akun `@tether.test` mana pun

**Jangan** jalankan `npx prisma migrate dev` — database dev dipakai bersama tim, shadow database migrate dev tidak punya skema `auth` milik Supabase dan bisa merusak riwayat migrasi. Migrasi baru dibuat lewat `npx prisma migrate diff` + `db execute`, atau tanya pemilik project.

## Pengujian

| Perintah | Apa yang diuji | Butuh database? |
|---|---|---|
| `pnpm test` | Logika murni (matching, health, experience, rate limit) — 68 unit test, Vitest | Tidak |
| `pnpm lint` | ESLint | Tidak |
| `pnpm build` | Build produksi + type-check | Tidak (semua halaman dinamis, tidak query saat build) |
| `pnpm e2e` | Alur kritis lewat browser sungguhan (Playwright, Chrome terpasang) — login, gerbang privasi, siklus proyek penuh | Ya, database dev dengan data seed |
| `npx tsx --env-file=.env scripts/smoke-test-*.ts` | Kasus tepi satu-satu ke database sungguhan (hapus akun, dormant freeze, dll) — lihat komentar tiap file | Ya |

`pnpm test`+`lint`+`build` berjalan di CI (`.github/workflows/ci.yml`) tanpa kredensial database sungguhan. `pnpm e2e` dan smoke test **sengaja tidak** dijalankan di CI — semuanya menulis ke database dev bersama, bukan sesuatu yang aman dijalankan otomatis di tiap push.

## Struktur

```
src/app/actions/     Server Actions ('use server') — satu file per domain
src/app/(app)/       Halaman setelah login (dibungkus AppShell)
src/app/api/         Route handler (cron kesehatan, ekspor akun)
src/lib/matching/    Mesin pencocokan (fungsi murni, tanpa akses Prisma)
src/lib/health/      Mesin kesehatan proyek (fungsi murni)
src/lib/validations/ Skema Zod per domain
src/components/      Komponen UI (SVG radar/gauge buatan sendiri, form)
prisma/schema.prisma Skema data (19 model)
prisma/seed.ts       Satu-satunya seed — skill, kandidat, proyek skenario
e2e/                 Playwright — alur kritis lewat browser sungguhan
scripts/             Smoke test kasus tepi + skrip pembersihan E2E
```

Otorisasi tingkat objek ditegakkan di lapisan Server Action (`getViewerAccess()`/`isActiveMember()` di `src/lib/team-membership.ts`), **bukan** RLS Postgres — koneksi Prisma memakai role yang punya `rolbypassrls: true`, jadi kebijakan RLS tidak pernah benar-benar dicek. Lihat `/security` di aplikasi untuk ringkasan checklist keamanan & privasi lengkap.

## Dokumen kerja

- `TENGGAT.md` — tenggat & peta waktu (sumber kebenaran tunggal soal jadwal)
- `RENCANA-BESAR.md` — rencana kerja aktif: pengembangan lanjutan + rombak UI/UX
- `RENCANA-PENGEMBANGAN-LANJUTAN.md` — backlog pasca-kompetisi
- `ROADMAP.md` — riwayat pembangunan fase-demi-fase (arsip, referensi teknis)
- `bagitugas/AKUN-DEMO.md` — daftar akun demo & perannya di data seed

## Deploy

Belum pernah di-deploy (per commit terakhir). Checklist env var & langkah verifikasi produksi ada di `RENCANA-BESAR.md` bagian H0.2.
