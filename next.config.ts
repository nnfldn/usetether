import type { NextConfig } from "next";

// basePath dari env var, BUKAN nilai tetap "/test" — supaya dev lokal, CI
// (.github/workflows/ci.yml), dan e2e (playwright.config.ts) tetap jalan
// dari root seperti biasa, tanpa prefix apa pun. Cuma di Vercel Production
// NEXT_BASE_PATH="/app" diisi (lihat RENCANA-BESAR.md H0.2) — landing page
// usetether.web.id tetap di root, Tether "diam-diam" di /app dulu sebelum
// keputusan domain final. Next.js otomatis menambahkan basePath ke <Link>,
// redirect() di Server Component/Route Handler, dan router di browser, jadi
// tidak ada path absolut di kode aplikasi yang perlu diubah manual. Yang
// TIDAK otomatis: Server Action yang form-nya ada di halaman statis, dan
// URL absolut yang dirakit sendiri di auth/confirm — keduanya ditangani di
// src/app/actions/auth.ts (redirectTo) dan src/lib/app-path.ts (appPath).
const nextConfig: NextConfig = {
  basePath: process.env.NEXT_BASE_PATH || undefined,
  // outputFileTracingIncludes SEMPAT dicoba di sini untuk bug engine
  // Prisma tidak ter-bundle ke fungsi serverless (15 Sep) -- TIDAK
  // berhasil (Next.js 16 Turbopack + custom Prisma output, lihat
  // prisma/prisma#29339). Fix sungguhan: driver adapter WASM, lihat
  // src/lib/prisma.ts + schema.prisma generator block. Dihapus dari sini
  // supaya tidak ada workaround mati yang membingungkan pembaca berikutnya.
};

export default nextConfig;
