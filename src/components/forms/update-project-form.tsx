"use client";

import { useActionState } from "react";
import { updateProjectAction, type ProjectActionState } from "@/app/actions/projects";

const initialState: ProjectActionState = { error: null };

type UpdateProjectFormProps = {
  project: {
    id: string;
    title: string;
    goal: string;
    tags: string[];
    deadline: Date | null;
    visibility: "PUBLIC" | "PRIVATE";
  };
};

export function UpdateProjectForm({ project }: UpdateProjectFormProps) {
  const [state, formAction, pending] = useActionState(updateProjectAction, initialState);

  // Parse YYYY-MM-DD for date input
  const deadlineStr = project.deadline ? project.deadline.toISOString().split("T")[0] : "";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="projectId" value={project.id} />
      
      <div className="space-y-1.5">
        <label htmlFor="title" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Judul Proyek
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={project.title}
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
          defaultValue={project.goal}
          className="md-field"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="tags" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Tag (Pisahkan dengan koma)
          </label>
          <input
            id="tags"
            name="tags"
            defaultValue={project.tags.join(", ")}
            className="md-field"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="deadline" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Tenggat Waktu
          </label>
          <input
            id="deadline"
            name="deadline"
            type="date"
            defaultValue={deadlineStr}
            className="md-field font-mono text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="visibility" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Aksesibilitas
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={project.visibility}
          className="md-field"
        >
          <option value="PUBLIC">Publik (Bisa ditemukan di Discovery)</option>
          <option value="PRIVATE">Privat (Hanya lewat undangan)</option>
        </select>
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
          {pending ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}