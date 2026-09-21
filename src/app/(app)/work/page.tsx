import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { TEAM_ROLE_LABEL, PROJECT_STATUS_LABEL } from "@/lib/labels";

export default async function WorkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const memberships = await prisma.teamMember.findMany({
    where: {
      profileId: user.id,
      status: "ACTIVE",
      team: {
        project: {
          status: { in: ["ACTIVE", "DRAFT"] },
        },
      },
    },
    include: {
      team: {
        include: {
          project: {
            include: {
              requirements: {
                include: { skill: true },
                orderBy: { importance: "desc" },
                take: 3,
              },
              milestones: {
                include: { tasks: { select: { id: true, status: true } } },
                orderBy: { deadline: "asc" },
              },
              team: {
                select: {
                  members: {
                    where: { status: "ACTIVE" },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const activeProjects = memberships.map((m) => ({
    role: m.role,
    joinedAt: m.joinedAt,
    project: m.team.project,
  }));

  return (
    <div className="page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline pb-5">
        <div>
          <p className="eyebrow">RUANG KERJA AKTIF</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-tight text-on-surface mt-1">
            Work
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Daftar proyek aktif yang kamu ikuti. Pilih proyek untuk langsung membuka kanban, milestone, dan task tim.
          </p>
        </div>
        <Link href="/projects" className="font-mono text-xs font-semibold text-primary hover:underline">
          Katalog Discovery →
        </Link>
      </div>

      {activeProjects.length === 0 ? (
        <div className="md-card p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-container border border-outline font-display text-xl font-bold text-on-surface-muted">
            0
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-on-surface">
              Belum Ada Proyek Aktif
            </h2>
            <p className="font-mono text-xs text-on-surface-muted max-w-md mx-auto leading-relaxed">
              Kamu belum bergabung dengan tim di proyek aktif mana pun. Temukan proyek yang membutuhkan keahlianmu di Discovery atau mulai inisiasi proyek baru.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/projects" className="md-btn md-btn-filled">
              Jelajahi Proyek
            </Link>
            <Link href="/projects/new" className="md-btn md-btn-outlined">
              ＋ Buat Proyek Baru
            </Link>
          </div>
        </div>
      ) : (
        <div className="project-grid">
          {activeProjects.map(({ project, role }) => {
            const isOwner = role === "Owner";
            const allTasks = project.milestones.flatMap((m) => m.tasks);
            const completedTasks = allTasks.filter((t) => t.status === "DONE").length;
            const completedMilestones = project.milestones.filter((m) => m.status === "DONE").length;

            return (
              <div
                key={project.id}
                className="project-item group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 font-display text-base font-bold text-primary bg-primary-container/20">
                      {project.title.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold">
                      <span className={`px-2 py-0.5 rounded-full border ${isOwner ? "border-primary bg-primary text-on-primary" : "border-outline bg-surface-container text-on-surface"}`}>
                        {TEAM_ROLE_LABEL[role] ?? role}
                      </span>
                      <span className="px-2 py-0.5 rounded-full border border-outline bg-surface-container text-primary">
                        {PROJECT_STATUS_LABEL[project.status] ?? project.status}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/projects/${project.id}/workspace`}
                    className="block"
                  >
                    <h2 className="font-display text-xl font-bold uppercase tracking-tight text-on-surface group-hover:text-primary transition-colors">
                      {project.title}
                    </h2>
                  </Link>

                  <p className="mt-1.5 text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                    {project.goal}
                  </p>

                  <div className="mt-4 p-3 rounded-[var(--radius-xs)] border border-outline/50 bg-surface-container/50 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Milestone:</span>
                      <strong className="text-on-surface">{completedMilestones} / {project.milestones.length}</strong>
                    </div>
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Task Selesai:</span>
                      <strong className="text-on-surface">{completedTasks} / {allTasks.length}</strong>
                    </div>
                  </div>

                  {project.requirements.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {project.requirements.map((r) => (
                        <span key={r.id} className="md-chip text-[10px]">
                          {r.skill.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <footer className="mt-5 pt-3 border-t border-outline flex items-center justify-between gap-2 font-mono text-xs">
                  <span className="text-on-surface-muted text-[11px]">
                    {project.team?.members.length ?? 0} Anggota Tim
                  </span>
                  <Link
                    href={`/projects/${project.id}/workspace`}
                    className="md-btn md-btn-filled md-btn-sm text-xs"
                  >
                    Buka Ruang Kerja →
                  </Link>
                </footer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
