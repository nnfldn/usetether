import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Driver adapter (query compiler WASM di dalam @prisma/client), BUKAN
// engine binary native — lihat catatan di schema.prisma generator block
// untuk kenapa: dua percobaan lain (binaryTargets, outputFileTracingIncludes)
// gagal membundel .so.node ke fungsi serverless Vercel dengan Next.js 16
// Turbopack, ketahuan lewat login sungguhan yang crash di production (15 Sep).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Singleton standar Next.js: tanpa ini, hot-reload dev server bikin banyak
// instance PrismaClient baru tiap edit file, cepat menghabiskan slot koneksi
// pooler. Di production (Vercel serverless) tiap invocation dapat modul
// segar, jadi ini terutama menyelamatkan pengalaman development.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
