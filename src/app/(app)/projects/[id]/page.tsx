import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeAlerts } from "@/lib/health/score";
import { HealthDashboard } from "@/components/health-dashboard";
import { WorkloadBars } from "@/components/workload-bars";
import { SubmitButton } from "@/components/submit-button";
import { ActionNotice } from "@/components/action-notice";
import { applyCandidateAction, respondInvitationAction } from "@/app/actions/team";
import { postProgressUpdateAction } from "@/app/actions/updates";
import { completeProjectAction } from "@/app/actions/projects";
import { PeerRatingForm } from "@/components/peer-rating-form";
import { MIN_PEER_RATERS } from "@/lib/matching/experience";
import { MAX_ACTIVE_PROJECTS } from "@/lib/validations/project";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";

function nowMs(): number {
  return Date.now();
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { id } = await params;
  const { e: noticeCode } = await searchParams;

  const [project, requirements, memberCount, latestSnapshot, snapshotWeekAgo, lateMilestone, lastActivity] =
    await Promise.all([
      prisma.project.findUnique({ where: { id } }),
      prisma.requirement.findMany({
        where: { projectId: id },
        include: { skill: true },
        orderBy: { importance: "desc" },
      }),
      prisma.teamMember.count({ where: { team: { projectId: id }, status: "ACTIVE" } }),
      prisma.healthSnapshot.findFirst({
        where: { projectId: id },
        orderBy: { snapshotDate: "desc" },
      }),
      prisma.healthSnapshot.findFirst({
        where: { projectId: id, snapshotDate: { lte: daysAgo(7) } },
        orderBy: { snapshotDate: "desc" },
      }),
      prisma.milestone.findFirst({
        where: { projectId: id, status: { not: "DONE" }, deadline: { lt: new Date() } },
        orderBy: { deadline: "asc" },
      }),
      prisma.activity.findFirst({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  if (!project) return notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = user?.id === project.ownerId;
  const [isActiveMember, myPendingInvitation] = user
    ? await Promise.all([
        prisma.teamMember.findFirst({
          where: { team: { projectId: id }, profileId: user.id, status: "ACTIVE" },
        }),
        !isOwner
          ? prisma.teamInvitation.findFirst({
              where: { projectId: id, profileId: user.id, status: "PENDING" },
            })
          : null,
      ])
    : [null, null];

  const myActiveMembershipCount =
    user && myPendingInvitation?.direction === "OWNER_INVITED"
      ? await prisma.teamMember.count({ where: { profileId: user.id, status: "ACTIVE" } })
      : 0;
  const myInvitationAtLimit = myActiveMembershipCount >= MAX_ACTIVE_PROJECTS;

  const now = nowMs();
  const allAlerts = latestSnapshot
    ? computeAlerts({
        milestoneDaysLate: lateMilestone
          ? Math.floor((now - lateMilestone.deadline.getTime()) / 86_400_000)
          : 0,
        pulseDropLast7Days: snapshotWeekAgo
          ? Math.max(0, snapshotWeekAgo.pulse - latestSnapshot.pulse)
          : undefined,
        balance: latestSnapshot.balance,
        forecast: latestSnapshot.forecast,
        daysSinceLastActivity: lastActivity
          ? Math.floor((now - lastActivity.createdAt.getTime()) / 86_400_000)
          : undefined,
      })
    : [];

  const isCompleted = project.status === "COMPLETED";
  const alerts = isCompleted
    ? []
    : isOwner
      ? allAlerts
      : allAlerts.filter((a) => a.to !== "OWNER_ONLY");

  const isMember = isOwner || Boolean(isActiveMember);

  const rateableTeammates =
    isMember && project.status === "COMPLETED" && user
      ? await (async () => {
          const [members, mine] = await Promise.all([
            prisma.teamMember.findMany({
              where: {
                team: { projectId: id },
                status: "ACTIVE",
                profileId: { not: user.id },
              },
              select: { profileId: true, profile: { select: { fullName: true } } },
            }),
            prisma.peerRating
              .findMany({
                where: { projectId: id, raterId: user.id },
                select: { ratedId: true, timeliness: true, quality: true, communication: true },
              })
              .catch(() => [] as { ratedId: string; timeliness: number; quality: number; communication: number }[]),
          ]);
          const mineByRated = new Map(mine.map((r) => [r.ratedId, r]));
          return members.map((m) => ({
            profileId: m.profileId,
            fullName: m.profile.fullName,
            existing: mineByRated.get(m.profileId) ?? null,
          }));
        })()
      : [];

  const workload = isOwner
    ? await (async () => {
        const [activities, members] = await Promise.all([
          prisma.activity.findMany({
            where: { projectId: id, createdAt: { gte: new Date(now - 14 * 86_400_000) } },
            select: { actorId: true, weight: true },
          }),
          prisma.teamMember.findMany({
            where: { team: { projectId: id }, status: "ACTIVE" },
            select: { profileId: true, profile: { select: { fullName: true } } },
          }),
        ]);
        const byActor = new Map<string, number>();
        for (const a of activities) byActor.set(a.actorId, (byActor.get(a.actorId) ?? 0) + a.weight);
        return members
          .map((m) => ({
            profileId: m.profileId,
            fullName: m.profile.fullName,
            contribution: byActor.get(m.profileId) ?? 0,
          }))
          .sort((a, b) => b.contribution - a.contribution);
      })()
    : [];

  const compositeHistory = isMember
    ? (
        await prisma.healthSnapshot.findMany({
          where: { projectId: id },
          orderBy: { snapshotDate: "desc" },
          take: 10,
          select: { composite: true },
        })
      )
        .reverse()
        .map((s) => s.composite)
    : [];

  const recentUpdates = isMember
    ? await prisma.progressUpdate.findMany({
        where: { projectId: id },
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return (
    <div className="space-y-6">
      <ActionNotice code={noticeCode} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        {/* Left Column: Details, Skills, Peer Ratings, Progress Updates */}
        <div className="space-y-6">
          <section className="md-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline pb-3">
              <div>
                <p className="eyebrow">RINGKASAN</p>
                <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                  {project.title}
                </h2>
              </div>
              <span className="font-mono text-xs uppercase font-bold px-2.5 py-0.5 border border-outline bg-surface-container text-primary">
                {PROJECT_STATUS_LABEL[project.status] ?? project.status}
              </span>
            </div>

            <p className="text-sm text-on-surface-body leading-relaxed">{project.goal}</p>

            <div className="flex flex-wrap gap-4 pt-2 font-mono text-xs text-on-surface-muted">
              <span>◷ Tenggat: {project.deadline ? new Date(project.deadline).toLocaleDateString("id-ID") : "Belum ditentukan"}</span>
              <span>♧ {memberCount} Anggota</span>
              <span>◉ {project.visibility === "PUBLIC" ? "Publik" : "Privat"}</span>
            </div>

            {project.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-outline/50">
                {project.tags.map((tag) => (
                  <span key={tag} className="md-chip">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {isOwner && project.status !== "COMPLETED" && (
              <form action={completeProjectAction} className="pt-4 border-t border-outline">
                <input type="hidden" name="projectId" value={project.id} />
                <button type="submit" className="md-btn md-btn-outlined md-btn-sm">
                  Tandai Proyek Selesai
                </button>
              </form>
            )}
          </section>

          <section className="md-card p-6 space-y-4">
            <div>
              <p className="eyebrow">KOMPOSISI KEBUTUHAN</p>
              <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                Kebutuhan Skill Tim
              </h2>
            </div>

            {requirements.length === 0 ? (
              <p className="font-mono text-xs text-on-surface-muted">Belum ada requirement skill.</p>
            ) : (
              <div className="space-y-3">
                {requirements.map((r) => (
                  <div key={r.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-on-surface">{r.skill.name}</span>
                      <span className="font-mono text-on-surface-muted">
                        Bobot {r.importance.toFixed(1)} ({Math.round(r.importance * 100)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-none bg-surface-container-high overflow-hidden border border-outline">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, r.importance * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {isMember && project.status === "COMPLETED" && rateableTeammates.length > 0 && (
            <section className="md-card p-6 space-y-4">
              <div>
                <p className="eyebrow">EVALUASI REKAN</p>
                <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                  Penilaian Rekan Satu Tim
                </h2>
                <p className="mt-1 font-mono text-xs text-on-surface-muted">
                  Penilaianmu tertutup dan anonymized: rekan tidak melihat skor individual, hanya rata-rata gabungan (min {MIN_PEER_RATERS} penilai).
                </p>
              </div>

              <div className="space-y-4">
                {rateableTeammates.map((t) => (
                  <PeerRatingForm
                    key={t.profileId}
                    projectId={project.id}
                    ratedId={t.profileId}
                    ratedName={t.fullName}
                    existing={t.existing}
                  />
                ))}
              </div>
            </section>
          )}

          {isMember && (
            <section className="md-card p-6 space-y-4">
              <div>
                <p className="eyebrow">LOG AKTIVITAS</p>
                <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                  Pembaruan Progres
                </h2>
              </div>

              {!isCompleted && (
                <form action={postProgressUpdateAction} className="space-y-2.5">
                  <input type="hidden" name="projectId" value={project.id} />
                  <textarea
                    name="body"
                    required
                    minLength={3}
                    maxLength={500}
                    rows={2}
                    placeholder="Bagikan pembaruan progres kerja singkat kepada tim..."
                    className="md-field"
                  />
                  <div className="flex justify-end">
                    <SubmitButton className="md-btn md-btn-filled md-btn-sm" pendingLabel="Mengirim...">
                      Kirim Progres
                    </SubmitButton>
                  </div>
                </form>
              )}

              {recentUpdates.length === 0 ? (
                <p className="font-mono text-xs text-on-surface-muted text-center py-4">
                  Belum ada log progres tercatat di proyek ini.
                </p>
              ) : (
                <ul className="space-y-3 pt-2 border-t border-outline">
                  {recentUpdates.map((u) => (
                    <li key={u.id} className="flex items-start gap-3 text-xs">
                      <span className="user-dot shrink-0">{initials(u.author.fullName)}</span>
                      <div className="space-y-0.5">
                        <p className="font-bold text-on-surface">{u.author.fullName}</p>
                        <p className="text-on-surface-variant leading-relaxed">{u.body}</p>
                        <p className="font-mono text-[10px] text-on-surface-muted">
                          {new Date(u.createdAt).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Actions, Health, Workload */}
        <div className="space-y-6">
          {!isOwner && user && !isActiveMember && (
            <section className="md-card md-card-accent p-6 space-y-4">
              <div>
                <p className="eyebrow">GABUNG PROYEK</p>
                <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                  Kontribusimu Dibutuhkan
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Proyek ini sedang mencari kolaborator sesuai komposisi keahlian di atas.
                </p>
              </div>

              {myPendingInvitation?.direction === "OWNER_INVITED" ? (
                <div className="space-y-3 pt-2">
                  <p className="font-mono text-xs text-on-surface-variant font-medium">
                    Owner proyek telah mengundangmu untuk bergabung ke tim.
                  </p>
                  <div className="flex items-center gap-2">
                    {myInvitationAtLimit ? (
                      <span className="font-mono text-xs text-on-surface-variant">
                        Maksimal {MAX_ACTIVE_PROJECTS} proyek aktif tercapai.
                      </span>
                    ) : (
                      <form action={respondInvitationAction}>
                        <input type="hidden" name="invitationId" value={myPendingInvitation.id} />
                        <input type="hidden" name="decision" value="ACCEPTED" />
                        <input type="hidden" name="redirectTo" value={`/projects/${project.id}`} />
                        <button type="submit" className="md-btn md-btn-filled md-btn-sm">
                          Terima Undangan
                        </button>
                      </form>
                    )}
                    <form action={respondInvitationAction}>
                      <input type="hidden" name="invitationId" value={myPendingInvitation.id} />
                      <input type="hidden" name="decision" value="DECLINED" />
                      <input type="hidden" name="redirectTo" value={`/projects/${project.id}`} />
                      <button type="submit" className="md-btn md-btn-outlined md-btn-sm text-error">
                        Tolak
                      </button>
                    </form>
                  </div>
                </div>
              ) : myPendingInvitation?.direction === "CANDIDATE_APPLIED" ? (
                <div className="p-3 border border-outline rounded bg-surface-container font-mono text-xs text-primary">
                  ✓ Lamaranmu telah terkirim. Menunggu persetujuan owner proyek.
                </div>
              ) : (
                <form action={applyCandidateAction} className="pt-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <button type="submit" className="md-btn md-btn-filled w-full">
                    Lamar Bergabung →
                  </button>
                </form>
              )}
            </section>
          )}

          {isMember && (
            <HealthDashboard
              snapshot={latestSnapshot}
              alerts={alerts}
              compositeHistory={compositeHistory}
              isCompleted={isCompleted}
            />
          )}

          {isOwner && (
            <section className="md-card p-6 space-y-4">
              <div>
                <p className="eyebrow">DISTRIBUSI KONTRIBUSI</p>
                <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                  Beban Kerja Tim (14 Hari)
                </h2>
              </div>
              <WorkloadBars members={workload} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
