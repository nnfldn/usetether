"use client";

import { useActionState } from "react";
import { addSkillAction, type ProfileActionState } from "@/app/actions/profile";

const initialState: ProfileActionState = { error: null };

export function AddSkillForm() {
  const [state, formAction, pending] = useActionState(addSkillAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label htmlFor="skillName" className="text-xs font-medium text-on-surface-variant">
          Nama skill
        </label>
        <input
          id="skillName"
          name="skillName"
          required
          placeholder="React, UI Design, ..."
          className="md-field"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="portfolioUrl" className="text-xs font-medium text-on-surface-variant">
          Link portofolio (opsional)
        </label>
        <input
          id="portfolioUrl"
          name="portfolioUrl"
          type="url"
          placeholder="https://..."
          className="md-field"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="md-btn md-btn-outlined"
      >
        {pending ? "Menambah…" : "Tambah skill"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-error">{state.error}</p>
      )}
    </form>
  );
}
