"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePasswordAction, type AuthActionState } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const initialState: AuthActionState = { error: null };

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  // router.push, bukan redirect() dari server — halaman statis + basePath
  // produksi, lihat catatan di AuthActionState.redirectTo (actions/auth.ts).
  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
  }, [state.redirectTo, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="flex items-center justify-between">
        <p className="md-title">Tether</p>
        <ThemeToggle compact />
      </div>
      <h1 className="text-2xl font-semibold">Atur ulang kata sandi</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <label htmlFor="password" className="flex flex-col gap-1">
          <span className="text-sm">Kata sandi baru</span>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="md-field"
          />
        </label>

        {state.error && (
          <p className="text-sm text-error" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="md-btn md-btn-filled"
        >
          {pending ? "Menyimpan…" : "Simpan kata sandi baru"}
        </button>
      </form>
    </main>
  );
}
