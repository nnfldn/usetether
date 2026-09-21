"use client";

import { useActionState } from "react";
import { changePasswordAction, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = { error: null, success: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.success && (
        <div className="p-3 border border-primary bg-primary-container text-on-primary-container font-mono text-xs rounded-[var(--radius-xs)]">
          ✓ Kata sandi akunmu berhasil diperbarui.
        </div>
      )}

      {state.error && (
        <div className="p-3 border border-error bg-error-container text-on-error-container font-mono text-xs rounded-[var(--radius-xs)]">
          ✕ {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="new-password"
          className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
        >
          Kata Sandi Baru
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Minimal 8 karakter, 1 huruf & 1 angka"
          className="md-field"
        />
        <p className="font-mono text-[11px] text-on-surface-muted">
          Gunakan kombinasi yang aman (minimal 8 karakter, 1 huruf dan 1 angka).
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="md-btn md-btn-filled md-btn-sm"
      >
        {pending ? "Memperbarui..." : "Perbarui Kata Sandi"}
      </button>
    </form>
  );
}
