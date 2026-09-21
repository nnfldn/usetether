"use client";

import Link from "next/link";

// Sebelumnya TIDAK ADA sama sekali — error apa pun di halaman manapun di
// bawah (app) (mis. requireMember yang melempar, query Prisma gagal)
// mendarat di layar error generik Next.js: putih polos, tanpa navigasi,
// tanpa penjelasan. AppShell di layout.tsx tetap terlihat di sekitar ini
// (error boundary Next.js cuma mengganti isi halaman, bukan layout di
// atasnya), jadi pengguna tidak kehilangan jalan keluar.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-narrow">
      <div className="md-card space-y-3 border-error bg-error-container p-6 text-center">
        <h1 className="md-headline text-on-error-container">Terjadi kesalahan</h1>
        <p className="text-sm text-on-error-container">
          Sesuatu gagal dimuat di halaman ini. Coba muat ulang — kalau masih terjadi,
          beri tahu tim Tether.
        </p>
        {error.digest && (
          <p className="text-xs text-on-error-container/70">Kode: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3 pt-1">
          <button type="button" onClick={reset} className="md-btn md-btn-filled">
            Coba lagi
          </button>
          <Link href="/projects" className="md-btn md-btn-outlined">
            Ke daftar proyek
          </Link>
        </div>
      </div>
    </div>
  );
}
