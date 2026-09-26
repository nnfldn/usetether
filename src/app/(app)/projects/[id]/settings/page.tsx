import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getViewerAccess } from "@/lib/team-membership";
import { UpdateProjectForm } from "@/components/forms/update-project-form";
import { DeleteProjectForm } from "@/components/forms/delete-project-form";
import { noticeUrl } from "@/lib/action-notice";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { isOwner } = await getViewerAccess(id, user.id);
  if (!isOwner) {
    redirect(noticeUrl(`/projects/${id}`, "DELETE_NOT_ALLOWED"));
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      goal: true,
      tags: true,
      deadline: true,
      visibility: true,
    },
  });

  if (!project) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="md-card p-6 sm:p-8">
        <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface mb-6">
          Pengaturan Proyek
        </h2>
        <UpdateProjectForm project={project} />
      </div>

      <div className="md-card p-6 sm:p-8 border-error/50">
        <h2 className="text-xl font-bold font-display uppercase tracking-tight text-error mb-4">
          Danger Zone
        </h2>
        <div className="p-4 rounded-lg bg-error-container/20 border border-error/30">
          <DeleteProjectForm projectId={project.id} />
        </div>
      </div>
    </div>
  );
}