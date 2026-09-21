"use client";

import { useActionState, useState } from "react";
import { createProjectAction, type ProjectActionState } from "@/app/actions/projects";

const initialState: ProjectActionState = { error: null };

type Row = { key: number; skillName: string; importance: number };

export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);
  const [rows, setRows] = useState<Row[]>([{ key: 0, skillName: "", importance: 0.6 }]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="title" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Judul Proyek
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="mis. EcoLens — Peta Ruang Terbuka Hijau"
          className="md-field"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="goal" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Tujuan Proyek
        </label>
        <textarea
          id="goal"
          name="goal"
          required
          rows={3}
          placeholder="Jelaskan tujuan utama proyek dan dampak yang ingin dicapai bersama tim..."
          className="md-field"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tags" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Tag / Topik (pisahkan dengan koma)
        </label>
        <input
          id="tags"
          name="tags"
          placeholder="web, ai, sustainability, mobile"
          className="md-field"
        />
        <p className="font-mono text-[11px] text-on-surface-muted">
          Dicocokkan dengan minat kandidat untuk komponen Interest mesin pencocokan.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="deadline" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Tenggat Waktu (Opsional)
          </label>
          <input
            id="deadline"
            name="deadline"
            type="date"
            className="md-field"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="visibility" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Visibilitas
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="PUBLIC"
            className="md-field"
          >
            <option value="PUBLIC">Publik (Bisa ditemukan di Discovery)</option>
            <option value="PRIVATE">Privat (Hanya lewat undangan)</option>
          </select>
        </div>
      </div>

      <div className="md-card p-4 sm:p-5 space-y-3 bg-surface-container/50">
        <div>
          <p className="font-display text-base font-bold uppercase tracking-wide text-on-surface">
            Kebutuhan Skill Tim
          </p>
          <p className="font-mono text-[11px] text-on-surface-muted mt-0.5">
            Bobot kepentingan (0 = santai, 1 = sangat kritis), dipakai mesin pencocokan untuk menghitung gap tim.
          </p>
        </div>

        <div className="space-y-2.5">
          {rows.map((row, i) => (
            <div key={row.key} className="flex items-center gap-2.5">
              <input
                name="reqSkill"
                placeholder="Nama skill (mis. React, UI Design)"
                defaultValue={row.skillName}
                required
                className="md-field flex-1"
              />
              <div className="flex items-center gap-1.5">
                <input
                  name="reqImportance"
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  defaultValue={row.importance}
                  className="md-field w-20 sm:w-24 text-center font-mono"
                  title="Bobot (0.0 - 1.0)"
                />
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                  className="md-btn md-btn-sm text-xs text-error hover:bg-error-container/20 shrink-0"
                >
                  Hapus
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRows([...rows, { key: Date.now() + rows.length, skillName: "", importance: 0.6 }])}
          className="md-btn md-btn-outlined md-btn-sm"
        >
          ＋ Tambah Baris Skill
        </button>
      </div>

      {state.error && (
        <div className="p-3 border border-error bg-error-container text-on-error-container text-xs font-mono rounded-[var(--radius-xs)]">
          {state.error}
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="md-btn md-btn-filled"
        >
          {pending ? "Membuat..." : "Buat Proyek"}
        </button>
      </div>
    </form>
  );
}
