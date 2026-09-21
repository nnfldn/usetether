import Link from "next/link";

// Halaman 404 bawaan Next.js tampil polos dengan gaya sendiri (latar gelap,
// tanpa navigasi) — terlihat seperti aplikasi yang rusak, bukan halaman
// yang memang tidak ada. Ketahuan saat pengujian browser ketika membuka
// URL proyek lama yang sudah terhapus.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="text-sm text-on-surface-body">
        Alamat yang kamu buka tidak ada, atau proyeknya sudah dihapus/ditutup.
      </p>
      <div className="flex justify-center gap-3">
        <Link href="/projects" className="md-btn md-btn-filled">
          Ke daftar proyek
        </Link>
        <Link href="/profile" className="md-btn md-btn-outlined">
          Ke profil
        </Link>
      </div>
    </main>
  );
}
