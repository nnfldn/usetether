"use client";

import { useActionState } from "react";
import {
  updateProfileAction,
  type ProfileActionState,
} from "@/app/actions/profile";

const initialState: ProfileActionState = { error: null };

export function EditProfileForm({
  fullName,
  faculty,
  bio,
  interests,
}: {
  fullName: string;
  faculty: string | null;
  bio: string | null;
  interests: string[];
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="fullName" className="text-sm font-medium">
          Nama lengkap
        </label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          required
          className="md-field w-full"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="faculty" className="text-sm font-medium">
          Fakultas/prodi
        </label>
        <input
          id="faculty"
          name="faculty"
          defaultValue={faculty ?? ""}
          className="md-field w-full"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="bio" className="text-sm font-medium">
          Bio singkat
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={bio ?? ""}
          rows={3}
          maxLength={500}
          className="md-field w-full"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="interests" className="text-sm font-medium">
          Minat (pisahkan dengan koma)
        </label>
        <input
          id="interests"
          name="interests"
          defaultValue={interests.join(", ")}
          placeholder="web, ai, sustainability"
          className="md-field w-full"
        />
        <p className="text-xs text-on-surface-muted">
          Dipakai mesin pencocokan untuk komponen Interest, cocokkan dengan
          tag proyek.
        </p>
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="md-btn md-btn-filled"
      >
        {pending ? "Menyimpan..." : "Simpan profil"}
      </button>
    </form>
  );
}
