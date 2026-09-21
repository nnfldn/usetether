import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getViewerAccess } from "@/lib/team-membership";
import { ProjectTabs } from "@/components/project-tabs";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { title: true, goal: true, status: true },
  });
  if (!project) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { isMember, isOwner } = await getViewerAccess(id, user?.id);

  return (
    <div className="page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline pb-5">
        <div>
          <p className="eyebrow">
            PROYEK · {PROJECT_STATUS_LABEL[project.status] ?? project.status}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-tight text-on-surface mt-1">
            {project.title}
          </h1>
          {project.goal && (
            <p className="text-sm text-on-surface-variant max-w-2xl mt-1.5 line-clamp-2">
              {project.goal}
            </p>
          )}
        </div>
        <Link
          href="/projects"
          className="text-xs font-mono font-semibold text-primary hover:underline whitespace-nowrap"
        >
          ← Semua Proyek
        </Link>
      </div>

      <nav>
        <ProjectTabs projectId={id} isMember={isMember} isOwner={isOwner} />
      </nav>

      <div>{children}</div>
    </div>
  );
}
