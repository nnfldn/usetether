"use client";

import { useActionState } from "react";
import { deleteProjectAction } from "@/app/actions/projects";

type DeleteProjectFormProps = {
  projectId: string;
};

export function DeleteProjectForm({ projectId }: DeleteProjectFormProps) {
  // Empty state because delete redirects on success
  const [_, formAction, pending] = useActionState(async (state: any, formData: FormData) => {
    // Optional: client-side confirmation
    if (confirm("Apakah Anda yakin ingin menghapus proyek ini? Seluruh data proyek akan hilang secara permanen.")) {
      await deleteProjectAction(formData);
    }
    return state;
  }, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-on-surface">Hapus Proyek</p>
          <p className="text-sm text-on-surface-variant">Tindakan ini tidak dapat dibatalkan.</p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="md-btn border border-error text-error hover:bg-error hover:text-on-error"
        >
          {pending ? "Menghapus..." : "Hapus Proyek"}
        </button>
      </div>
    </form>
  );
}