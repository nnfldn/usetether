import { headers } from "next/headers";

// Rate limiting sederhana in-memory — bukan Redis/Upstash, cukup untuk
// skala demo kompetisi (checklist keamanan Blueprint Bagian 09: rate
// limiting login/registrasi/undangan).
//
// KETERBATASAN yang disengaja: di lingkungan serverless multi-instance
// (Vercel dengan traffic besar), Map ini TIDAK dibagi antar instance —
// limitnya jadi per-instance, bukan benar-benar global. Untuk skala demo
// ini cukup; kalau nanti traffic sungguhan besar, ganti isi
// checkRateLimit() ke Upstash Redis — signature fungsi ini sengaja
// sederhana (string key, dua angka) supaya gampang diswap tanpa mengubah
// pemanggilnya di auth.ts/team.ts.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Dibersihkan berkala supaya Map tidak bocor memori tanpa batas selama
// proses server hidup lama (dev server / instance Vercel yang warm).
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();
function cleanupExpired(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Fixed window sederhana: `limit` percobaan per `windowMs` untuk satu
 * `key`. Return true = masih boleh lanjut, false = kena limit (tolak).
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  cleanupExpired(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count++;
  return true;
}

// Ambang rate limit bisa ditimpa lewat env var — dipakai untuk menaikkan
// batas login/registrasi di Vercel Preview (latihan demo berulang) dan di
// .env lokal (E2E login banyak akun bergantian) TANPA mengubah default
// produksi. Kalau env kosong/tidak valid, jatuh balik ke `fallback`.
export function limitFromEnv(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Server Action tidak punya akses langsung ke objek Request, tapi
// next/headers tetap terbaca dalam scope satu request — Vercel selalu
// mengisi x-forwarded-for di baris paling depan dengan IP klien asli.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}
