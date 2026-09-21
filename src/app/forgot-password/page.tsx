"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type AuthActionState } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const initialState: AuthActionState & { success?: boolean } = { error: null };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-background">
      <div className="w-full max-w-xl border border-outline bg-surface-container p-6 sm:p-10 shadow-sm">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline/40">
          <Link href="/" className="font-['Barlow_Condensed'] text-2xl font-bold uppercase tracking-tight text-on-surface hover:text-primary transition-colors">
            Tether<span className="text-primary">.</span>
          </Link>
          <ThemeToggle compact />
        </div>

        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-on-surface-muted mb-1">
          Pemulihan Keamanan
        </p>
        <h1 className="font-['Barlow_Condensed'] text-3xl font-bold uppercase tracking-tight text-on-surface mb-2">
          Atur Ulang Kata Sandi
        </h1>
        <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
          Masukkan alamat email yang terdaftar pada akun Tether kamu. Kami akan mengirimkan tautan aman untuk menyetel ulang kata sandi.
        </p>

        {state.success ? (
          <div className="border border-health-good bg-health-good-container/30 p-5 text-sm text-on-surface mb-6">
            <p className="font-bold text-health-good-text mb-1 flex items-center gap-2">
              <span>✓</span> Instruksi Telah Dikirim
            </p>
            <p className="text-xs text-on-surface-variant">
              Jika email tersebut terdaftar di sistem Tether, tautan reset telah dikirimkan. Silakan periksa kotak masuk atau folder spam Anda.
            </p>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <label htmlFor="email" className="flex flex-col gap-1.5">
              <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                Alamat Email Akun
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
              {pending ? "Mengirim Permintaan…" : "Kirim Tautan Atur Ulang →"}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-outline/40 flex items-center justify-between text-xs">
          <Link
            href="/sign-in"
            className="font-mono uppercase tracking-wider font-semibold text-primary hover:underline"
          >
            ← Kembali ke Masuk
          </Link>
          <Link
            href="/"
            className="text-on-surface-muted hover:text-primary transition-colors"
          >
            Beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
