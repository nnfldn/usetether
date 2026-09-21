"use client";

import { deleteAccountAction } from "@/app/actions/account";
import { useRef } from "react";

export function ConfirmDeleteAccount() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={deleteAccountAction}
      className="pt-1"
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Yakin ingin menghapus akun? Tindakan ini tidak bisa dibatalkan dan semua data pribadimu akan dihapus permanen.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="md-btn md-btn-danger md-btn-sm text-xs"
      >
        Hapus Akun Saya
      </button>
    </form>
  );
}
