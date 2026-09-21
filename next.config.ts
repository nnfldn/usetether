import type { NextConfig } from "next";

// basePath dari env var, BUKAN nilai tetap "/test" — supaya dev lokal, CI
// (.github/workflows/ci.yml), dan e2e (playwright.config.ts) tetap jalan
// dari root seperti biasa, tanpa prefix apa pun. Cuma di Vercel Production
// NEXT_BASE_PATH="/test" diisi (lihat RENCANA-BESAR.md H0.2) — landing
// page usetether.web.id tetap di root, Tether "diam-diam" di /test dulu
// sebelum keputusan domain final. Next.js otomatis menambahkan basePath
// ke SEMUA redirect()/<Link>/asset internal, jadi tidak ada path absolut
// di kode aplikasi yang perlu diubah manual.
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
