import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { TEAM_ROLE_LABEL } from "@/lib/labels";

export default async function ProjectHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const memberships = await prisma.teamMember.findMany({
    where: { profileId: user.id, team: { project: { status: "COMPLETED" } } },
    include: {
      team: {
        include: {
          project: {
            include: {
              healthSnapshots: { orderBy: { snapshotDate: "desc" }, take: 1 },
              milestones: { select: { status: true } },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div className="page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline pb-5">
        <div>
          <p className="eyebrow">ARSIP PRIBADI</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-tight text-on-surface mt-1">
            Riwayat Proyek
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Daftar proyek yang telah rampung dan pernah kamu kerjakan bersama tim.
          </p>
        </div>
        <Link href="/projects" className="font-mono text-xs font-semibold text-primary hover:underline">
          ← Kembali ke Discovery
        </Link>
      </div>

      {memberships.length === 0 ? (
        <div className="md-card p-12 text-center space-y-2">
          <p className="font-mono text-sm text-on-surface-muted">
            Belum ada riwayat proyek selesai. Proyek yang ditandai selesai oleh owner akan diarsipkan di sini.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {memberships.map((m) => {
            const project = m.team.project;
            const finalHealth = project.healthSnapshots[0];
            const doneMilestones = project.milestones.filter((ms) => ms.status === "DONE").length;
            return (
              <li key={m.id} className="md-card md-card-accent p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-outline pb-3">
                  <div className="flex-1">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-display text-2xl font-bold uppercase tracking-tight text-on-surface hover:text-primary transition-colors"
                    >
                      {project.title}
                    </Link>
                    <p className="mt-1 text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                      {project.goal}
                    </p>
                  </div>
                  <span className="font-mono text-xs uppercase font-bold px-2.5 py-0.5 rounded-full border border-primary bg-primary-container text-on-primary-container shrink-0 self-start">
                    Selesai
                  </span>
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <dt className="text-on-surface-muted uppercase">Peran Kamu</dt>
                    <dd className="font-bold text-on-surface">{TEAM_ROLE_LABEL[m.role] ?? m.role}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-on-surface-muted uppercase">Bergabung</dt>
                    <dd className="font-bold text-on-surface">
                      {new Date(m.joinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-on-surface-muted uppercase">Milestone Rampung</dt>
                    <dd className="font-bold text-on-surface">
                      {doneMilestones} / {project.milestones.length}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-on-surface-muted uppercase">Skor Kesehatan Akhir</dt>
                    <dd className="font-bold text-primary">
                      {finalHealth?.composite != null ? `${finalHealth.composite.toFixed(0)} / 100` : "—"}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
