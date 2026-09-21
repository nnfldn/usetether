// Jaring pengaman luas untuk SELURUH halaman di bawah (app) — sebelumnya
// tidak ada loading.tsx sama sekali, jadi navigasi antar halaman data-berat
// (mis. /projects/[id]/team, yang menjalankan banyak query berurutan)
// terasa diam saja sebelum kontennya muncul. Skeleton generik di sini,
// bukan per-halaman: cakupan luas lebih penting sekarang daripada skeleton
// yang meniru bentuk tiap halaman persis.
export default function AppLoading() {
  return (
    <div className="page space-y-4" aria-live="polite" aria-busy="true">
      <span className="sr-only">Memuat…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="md-card h-24 animate-pulse bg-surface-container" />
      ))}
    </div>
  );
}
