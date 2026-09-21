"use client";

import { useFormStatus } from "react-dom";

// Tombol submit yang menonaktifkan dirinya selama Server Action berjalan.
//
// KENAPA PERLU: form Server Action di aplikasi ini melakukan operasi
// database yang tidak idempotent (buat milestone, buat task, kirim
// komentar, undang kandidat). Tanpa penanda "sedang diproses", klik ganda
// saat koneksi lambat — persis kondisi saat demo di jaringan asing —
// bisa membuat data dobel, dan pengguna tidak tahu apakah kliknya masuk.
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className ?? ""} disabled:opacity-50`}>
      {pending ? (pendingLabel ?? "Memproses…") : children}
    </button>
  );
}
