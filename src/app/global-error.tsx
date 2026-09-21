"use client";

// Menangkap error di ROOT layout itu sendiri (di luar jangkauan
// (app)/error.tsx) — kasus langka (mis. layout.tsx gagal memuat font),
// tapi tanpa berkas ini Next.js jatuh balik ke layar putih tanpa apa pun.
// WAJIB merender <html>/<body> sendiri karena root layout yang bermasalah
// tidak ikut dirender di sini.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Terjadi kesalahan</h1>
            <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 16 }}>
              Aplikasi gagal dimuat. Coba muat ulang halaman.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 40,
                padding: "0 24px",
                borderRadius: 0,
                background: "#000000",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                border: "1px solid #000000",
                cursor: "pointer",
              }}
            >
              Coba lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
