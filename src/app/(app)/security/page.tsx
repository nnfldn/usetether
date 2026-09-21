import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions/auth";
import { ConfirmDeleteAccount } from "@/components/confirm-delete-account";
import { ChangePasswordForm } from "@/components/forms/change-password-form";

const SECURITY_ITEMS = [
  { label: "Hash kata sandi (Argon2id/bcrypt)", detail: "Ditangani Supabase Auth, Tether tidak pernah menyimpan atau memproses kata sandi mentah sendiri." },
  { label: "Sesi di cookie httpOnly · Secure · SameSite", detail: "Bawaan @supabase/ssr, diperbarui tiap request lewat middleware proxy." },
  { label: "Validasi skema di sisi server", detail: "Zod di setiap Server Action: validasi client-side tidak pernah jadi satu-satunya lapisan." },
  { label: "Otorisasi tingkat objek pada setiap query", detail: "getViewerAccess() / isActiveMember() dicek sebelum query data privat dijalankan, bukan cuma disembunyikan di UI." },
  {
    label: "Rate limiting login, registrasi, undangan",
    detail: "Default 5 percobaan login/5 menit, 3 registrasi/10 menit, 30 undangan-lamaran/jam per proses.",
  },
  { label: "Proteksi CSRF pada semua mutasi", detail: "Bawaan Next.js Server Actions (verifikasi header Origin vs Host)." },
  { label: "Escaping keluaran (XSS Protection)", detail: "React meng-escape semua teks secara default; tidak ada injeksi HTML via dangerouslySetInnerHTML." },
  {
    label: "HTTPS dipaksa, HSTS aktif",
    detail: "Berlaku otomatis di lingkungan produksi cloud.",
    pending: true,
  },
];

const PRIVACY_ITEMS = [
  { label: "Workspace privat secara default", detail: "Metadata proyek publik untuk penemuan; milestone, task, radar tim, diskusi, dan indikator kesehatan hanya untuk anggota tim." },
  { label: "Data kesehatan hanya untuk anggota tim", detail: "Dashboard 4 indikator + peringatan dini digate privat; peringatan beban kerja (Balance) hanya dikirim ke owner." },
  { label: "Ketersediaan waktu = blok kasar", detail: "Hari + rentang waktu (Pagi/Siang/Sore/Malam), bukan kalender detail per jam." },
  { label: "Minimisasi data pribadi", detail: "Tidak ada NIM, alamat, atau nomor telepon di database; hanya nama, fakultas (opsional), bio, minat, skill." },
  { label: "Ekspor dan hapus akun tersedia", detail: "Tersedia kapan saja: unduh salinan data pribadi sebagai JSON atau hapus akun permanen." },
  { label: "Audit log keanggotaan tim", detail: "Dicatat tiap kali seseorang bergabung/keluar dari tim proyek, terlihat oleh owner di halaman Tim." },
];

export default async function SecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  return (
    <div className="page-narrow space-y-6">
      <div className="border-b border-outline pb-5">
        <p className="eyebrow">PENGATURAN KEAMANAN &amp; PRIVASI</p>
        <h1 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-tight text-on-surface mt-1">
          Keamanan &amp; Privasi
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant max-w-xl">
          Kelola kredensial akun, sesi aktif, dan kendalikan hak privasi serta visibilitas datamu di Tether.
        </p>
      </div>

      {/* 1. Ganti Kata Sandi */}
      <section className="md-card p-6 space-y-4">
        <div className="border-b border-outline pb-3">
          <p className="eyebrow">KREDENSIAL AKUN</p>
          <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
            Ganti Kata Sandi
          </h2>
          <p className="mt-0.5 font-mono text-xs text-on-surface-muted">
            Perbarui kata sandi akunmu secara langsung tanpa perlu meminta email tautan reset.
          </p>
        </div>

        <ChangePasswordForm />
      </section>

      {/* 2. Sesi Login & Akun */}
      <section className="md-card p-6 space-y-4">
        <div className="border-b border-outline pb-3">
          <p className="eyebrow">SESI &amp; PERANGKAT</p>
          <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
            Sesi Login Aktif
          </h2>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-[var(--radius-xs)] border border-outline bg-surface-container/50">
            <div>
              <span className="font-bold text-on-surface">Email Terdaftar:</span>
              <span className="ml-2 text-on-surface-variant">{user.email}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-primary px-2 py-0.5 rounded border border-primary/40 bg-primary-container/20 self-start sm:self-auto">
              ✓ Terverifikasi
            </span>
          </div>

          <div className="p-3 rounded-[var(--radius-xs)] border border-outline bg-surface-container/50 space-y-1">
            <p className="font-bold text-on-surface">Proteksi Sesi Browser:</p>
            <p className="text-on-surface-muted text-[11px]">
              Cookie sesi diamankan dengan flag <code className="text-primary font-bold">httpOnly</code>, <code className="text-primary font-bold">Secure</code>, dan <code className="text-primary font-bold">SameSite=Lax</code>.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <form action={signOutAction}>
            <button
              type="submit"
              className="md-btn md-btn-outlined md-btn-sm text-xs text-error hover:bg-error-container/20"
            >
              Keluar dari Sesi Ini
            </button>
          </form>
        </div>
      </section>

      {/* 3. Hak Privasi Data & Hapus Akun */}
      <section className="md-card md-card-accent p-6 space-y-4">
        <div className="border-b border-outline pb-3">
          <p className="eyebrow">KENDALI DATA PRIBADI</p>
          <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
            Hak Akses &amp; Penghapusan Data
          </h2>
          <p className="mt-0.5 font-mono text-xs text-on-surface-muted leading-relaxed">
            Sesuai prinsip perlindungan data pribadi, kamu memiliki hak penuh untuk mengunduh seluruh data akunmu atau menghapusnya secara permanen.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-[var(--radius-xs)] border border-outline bg-surface-container/40 space-y-2">
            <p className="font-display font-bold text-base uppercase text-on-surface">
              Ekspor Data Akun
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Unduh salinan lengkap profil, keahlian, minat, ketersediaan, dan riwayat keanggotaan dalam format JSON.
            </p>
            <a
              href="/api/account/export"
              download
              className="md-btn md-btn-outlined md-btn-sm text-xs font-mono inline-flex mt-1"
            >
              Unduh Data (JSON)
            </a>
          </div>

          <div className="p-4 rounded-[var(--radius-xs)] border border-error/50 bg-error-container/10 space-y-2">
            <p className="font-display font-bold text-base uppercase text-error">
              Hapus Akun Permanen
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Mencabut sesi, menghapus profil dan data pribadi secara permanen (anonimisasi).
            </p>
            <ConfirmDeleteAccount />
          </div>
        </div>
      </section>

      {/* 4. Transparansi Arsitektur & Etika Sistem */}
      <section className="md-card p-6 space-y-4">
        <details className="group cursor-pointer">
          <summary className="flex items-center justify-between font-display text-base font-bold uppercase tracking-wider text-on-surface">
            <span>Transparansi Arsitektur &amp; Etika Sistem</span>
            <span className="font-mono text-xs text-on-surface-muted group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>

          <div className="mt-4 border-t border-outline pt-4 space-y-5">
            <div>
              <p className="font-mono text-xs font-bold uppercase text-primary mb-2">Lapis Keamanan Teknis</p>
              <ul className="space-y-3">
                {SECURITY_ITEMS.map((item) => (
                  <li key={item.label} className="text-xs space-y-0.5">
                    <p className="font-bold font-mono text-on-surface flex items-center gap-2">
                      <span className="text-primary font-bold">{"pending" in item && item.pending ? "◻" : "✓"}</span>
                      <span>{item.label}</span>
                    </p>
                    <p className="text-on-surface-variant leading-relaxed pl-4">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-outline/50">
              <p className="font-mono text-xs font-bold uppercase text-primary mb-2">Prinsip Privasi Desain</p>
              <ul className="space-y-3">
                {PRIVACY_ITEMS.map((item) => (
                  <li key={item.label} className="text-xs space-y-0.5">
                    <p className="font-bold font-mono text-on-surface flex items-center gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>{item.label}</span>
                    </p>
                    <p className="text-on-surface-variant leading-relaxed pl-4">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-outline/50">
              <p className="font-mono text-xs font-bold uppercase text-primary mb-2">Etika Pemantauan Kesehatan Proyek</p>
              <ul className="list-disc space-y-1.5 pl-5 text-xs text-on-surface-variant leading-relaxed">
                <li>Tidak ada papan peringkat individu antar mahasiswa di Tether.</li>
                <li>Peringatan dini ketimpangan beban kerja (Balance) hanya dapat dilihat owner secara privat.</li>
                <li>Riwayat kesehatan proyek tidak pernah dipublikasikan di profil publik mahasiswa.</li>
              </ul>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
