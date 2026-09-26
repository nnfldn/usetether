"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInAction, demoSignInAction, type AuthActionState } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const initialState: AuthActionState = { error: null };

export default function SignInPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [demoState, demoAction, demoPending] = useActionState(demoSignInAction, initialState);

  // router.push, bukan redirect() dari server: di halaman statis (login, daftar,
  // demo) Server Action menjawab 303 dengan Location apa adanya sehingga
  // basePath produksi hilang, sedangkan router di browser tahu soal basePath.
  // Catatan lengkap di AuthActionState.redirectTo (actions/auth.ts).
  useEffect(() => {
    const target = state.redirectTo ?? demoState.redirectTo;
    if (target) router.push(target);
  }, [state.redirectTo, demoState.redirectTo, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-background">
      <div className="w-full max-w-4xl border border-outline bg-surface grid grid-cols-1 lg:grid-cols-12 shadow-sm">
        {/* Kolom Kiri: Presentasi Brand & Konteks Kampus */}
        <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-outline bg-surface-container-high/40">
          <div>
            <div className="mb-8">
              <Link href="/" className="font-['Barlow_Condensed'] text-2xl font-bold uppercase tracking-tight text-on-surface hover:text-primary transition-colors">
                Tether<span className="text-primary">.</span>
              </Link>
            </div>

            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-on-surface-muted mb-2">
              Siklus Kolaborasi Kampus
            </p>
            <h2 className="font-['Barlow_Condensed'] text-3xl sm:text-4xl font-bold uppercase tracking-tight text-on-surface leading-none mb-4">
              Lanjutkan Proyek Bersama Timmu.
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
              Masuk untuk memantau milestone, mengawal verifikasi Delivery Gate, dan melihat skor kesehatan proyek secara real-time.
            </p>

            <div className="space-y-3 pt-4 border-t border-outline/40">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-primary">01</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface">Adaptive Team Formation</p>
                  <p className="text-[11px] text-on-surface-muted">Pencocokan talenta berdasarkan gap keahlian nyata tim.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-primary">02</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface">Dual-Confirmation Gate</p>
                  <p className="text-[11px] text-on-surface-muted">Tugas diverifikasi oleh pemilik proyek, bebas free-rider.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-primary">03</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface">Project Health Snapshot</p>
                  <p className="text-[11px] text-on-surface-muted">Deteksi risiko keterlambatan dengan metrik ilmiah harian.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-outline/40 flex items-center justify-between text-xs text-on-surface-muted">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
              <span className="h-2 w-2 bg-health-good inline-block"></span>
              50+ Proyek Terbuka
            </span>
            <Link href="/" className="hover:text-primary transition-colors">
              ← Beranda
            </Link>
          </div>
        </div>

        {/* Kolom Kanan: Formulir Masuk */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-surface-container">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-on-surface-muted">
                Autentikasi Pengguna
              </p>
              <h1 className="font-['Barlow_Condensed'] text-2xl sm:text-3xl font-bold uppercase tracking-tight text-on-surface mt-0.5">
                Masuk ke Tether
              </h1>
            </div>
            <ThemeToggle compact />
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <label htmlFor="email" className="flex flex-col gap-1.5">
              <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                Email Kampus / Akun
              </span>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="nama@kampus.ac.id"
                className="rounded-none border border-outline bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-on-surface-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </label>

            <label htmlFor="password" className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                  Kata Sandi
                </span>
                <Link
                  href="/forgot-password"
                  className="font-mono text-xs text-on-surface-muted hover:text-primary transition-colors"
                >
                  Lupa sandi?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="rounded-none border border-outline bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-on-surface-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </label>

            {state.error && (
              <div className="border border-error bg-error-container/20 p-3 text-xs text-error font-medium" role="alert">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-none border border-primary bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-primary hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {pending ? "Memverifikasi…" : "Masuk ke Akun →"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-outline/40">
            <form action={demoAction} className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={demoPending}
                className="rounded-none border border-outline bg-surface px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface hover:border-primary hover:text-primary disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {demoPending ? "Menyiapkan demo…" : "Coba Demo Tanpa Daftar →"}
              </button>
              {demoState.error && (
                <p className="text-[11px] text-error" role="alert">{demoState.error}</p>
              )}
            </form>
          </div>

          <div className="mt-6 pt-6 border-t border-outline/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-on-surface-variant">Belum memiliki akun Tether?</span>
            <Link
              href="/sign-up"
              className="font-mono uppercase tracking-wider font-semibold text-primary hover:underline"
            >
              Daftar Akun Baru →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
