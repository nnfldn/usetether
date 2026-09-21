import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  computeMatch,
  applyExplorationSlot,
  type Candidate,
  type TeamContext,
  MAX_EXPERIENCE_WEIGHT,
} from "@/lib/matching/score";
import {
  computeExperience,
  computePeerRatingNorm,
  type PeerRatingInput,
} from "@/lib/matching/experience";
import { TeamRadar, type RadarAxis } from "@/components/team-radar";
import {
  inviteCandidateAction,
  respondInvitationAction,
  endorseSkillAction,
  leaveProjectAction,
} from "@/app/actions/team";
import { updateMatchWeightsAction } from "@/app/actions/projects";
import { MAX_ACTIVE_PROJECTS } from "@/lib/validations/project";
import { getViewerAccess } from "@/lib/team-membership";
import { ActionNotice } from "@/components/action-notice";
import { TEAM_ROLE_LABEL } from "@/lib/labels";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function dedupeSlots(slots: { dayOfWeek: number; block: string }[]) {
  const seen = new Set<string>();
  const out: { dayOfWeek: number; block: string }[] = [];
  for (const s of slots) {
    const key = `${s.dayOfWeek}-${s.block}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

export default async function ProjectTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { id: projectId } = await params;
  const { e: noticeCode } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();
  const isOwner = user?.id === project.ownerId;

  const { isMember } = await getViewerAccess(projectId, user?.id);
  if (!isMember) {
    return (
      <div className="md-card p-8 text-center text-sm text-on-surface-variant">
        Konten tim privat untuk anggota tim proyek ini.
      </div>
    );
  }

  const [requirements, activeMembers, pendingInvitations] = await Promise.all([
    prisma.requirement.findMany({ where: { projectId }, include: { skill: true } }),
    prisma.teamMember.findMany({
      where: { team: { projectId }, status: "ACTIVE" },
      include: {
        profile: {
          include: {
            skills: { include: { skill: true, endorsements: true } },
            availability: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.teamInvitation.findMany({
      where: { projectId, status: "PENDING" },
      include: { profile: true },
    }),
  ]);

  const memberProfileIds = new Set(activeMembers.map((m) => m.profileId));
  const pendingInviteByProfileId = new Map(
    pendingInvitations.filter((i) => i.direction === "OWNER_INVITED").map((i) => [i.profileId, i]),
  );
  const pendingApplications = pendingInvitations.filter((i) => i.direction === "CANDIDATE_APPLIED");

  const applicantMembershipCounts = new Map<string, number>();
  if (pendingApplications.length > 0) {
    const counts = await prisma.teamMember.groupBy({
      by: ["profileId"],
      where: { profileId: { in: pendingApplications.map((a) => a.profileId) }, status: "ACTIVE" },
      _count: { profileId: true },
    });
    for (const c of counts) applicantMembershipCounts.set(c.profileId, c._count.profileId);
  }

  const auditLogs = isOwner
    ? await prisma.auditLog.findMany({
        where: { projectId },
        include: { actor: { select: { fullName: true } }, targetProfile: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const coverageBySkill = new Map<string, number>();
  for (const member of activeMembers) {
    for (const ps of member.profile.skills) {
      coverageBySkill.set(
        ps.skillId,
        Math.max(coverageBySkill.get(ps.skillId) ?? 0, ps.evidenceLevel),
      );
    }
  }

  const teamContext: TeamContext = {
    requirements: requirements.map((r) => ({ skillId: r.skillId, importance: r.importance })),
    currentCoverage: Array.from(coverageBySkill.entries()).map(([skillId, coverage]) => ({
      skillId,
      coverage,
    })),
    skillNames: new Map(requirements.map((r) => [r.skillId, r.skill.name])),
    teamAvailability: dedupeSlots(
      activeMembers.flatMap((m) =>
        m.profile.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, block: a.block })),
      ),
    ),
  };

  const radarAxes: RadarAxis[] = requirements.map((r) => ({
    skillName: r.skill.name,
    requirement: r.importance,
    coverage: coverageBySkill.get(r.skillId) ?? 0,
  }));

  const candidateProfiles = await prisma.profile.findMany({
    where: { id: { notIn: Array.from(memberProfileIds) } },
    include: { skills: true, availability: true },
    take: 50,
  });

  const candidateIds = candidateProfiles.map((p) => p.id);
  const [completedMemberships, ownedDoneMilestones, peerRatings] = await Promise.all([
    prisma.teamMember.findMany({
      where: { profileId: { in: candidateIds }, status: "ACTIVE", team: { project: { status: "COMPLETED" } } },
      select: { profileId: true },
    }),
    prisma.milestone.findMany({
      where: { ownerId: { in: candidateIds }, status: "DONE" },
      select: { ownerId: true, deadline: true, updatedAt: true },
    }),
    prisma.peerRating
      .findMany({
        where: { ratedId: { in: candidateIds } },
        select: { ratedId: true, raterId: true, timeliness: true, quality: true, communication: true },
      })
      .catch(() => [] as { ratedId: string; raterId: string; timeliness: number; quality: number; communication: number }[]),
  ]);

  const peerRatingsByProfile = new Map<string, PeerRatingInput[]>();
  for (const r of peerRatings) {
    const list = peerRatingsByProfile.get(r.ratedId) ?? [];
    list.push(r);
    peerRatingsByProfile.set(r.ratedId, list);
  }
  const completedProjectsByProfile = new Map<string, number>();
  for (const m of completedMemberships) {
    completedProjectsByProfile.set(m.profileId, (completedProjectsByProfile.get(m.profileId) ?? 0) + 1);
  }
  const milestoneStatsByProfile = new Map<string, { onTime: number; total: number }>();
  for (const m of ownedDoneMilestones) {
    const stat = milestoneStatsByProfile.get(m.ownerId) ?? { onTime: 0, total: 0 };
    stat.total++;
    if (m.updatedAt <= m.deadline) stat.onTime++;
    milestoneStatsByProfile.set(m.ownerId, stat);
  }

  const candidates: Candidate[] = candidateProfiles.map((p) => {
    const milestoneStat = milestoneStatsByProfile.get(p.id) ?? { onTime: 0, total: 0 };
    return {
      profileId: p.id,
      skills: p.skills.map((s) => ({ skillId: s.skillId, level: s.evidenceLevel })),
      availability: p.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, block: a.block })),
      interests: p.interests,
      experience: computeExperience({
        completedProjectsCount: completedProjectsByProfile.get(p.id) ?? 0,
        completedMilestonesOnTime: milestoneStat.onTime,
        completedMilestonesTotal: milestoneStat.total,
        peerRatingNorm: computePeerRatingNorm(peerRatingsByProfile.get(p.id) ?? []),
      }),
    };
  });

  const projectWeights = {
    gapCoverage: project.weightGapCoverage,
    availability: project.weightAvailability,
    complementarity: project.weightComplementarity,
    interest: project.weightInterest,
    experience: project.weightExperience,
  };

  const ranked = applyExplorationSlot(
    candidates
      .map((c) => computeMatch(c, teamContext.requirements, project.tags, teamContext, projectWeights))
      .sort((a, b) => b.score - a.score),
  );

  const nameById = new Map(candidateProfiles.map((p) => [p.id, p.fullName]));

  return (
    <div className="space-y-6">
      <ActionNotice code={noticeCode} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
        {/* Left Column: Team Members, Applications, Audit Log */}
        <div className="space-y-6">
          <section className="md-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline pb-3">
              <div>
                <p className="eyebrow">TIM AKTIF</p>
                <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                  Anggota Tim ({activeMembers.length})
                </h2>
              </div>
            </div>

            <ul className="space-y-3">
              {activeMembers.map((m) => (
                <li key={m.id} className="p-4 rounded-[var(--radius-xs)] border border-outline bg-surface-container/50 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="user-dot">{initials(m.profile.fullName)}</span>
                      <div>
                        <p className="font-bold text-sm text-on-surface">{m.profile.fullName}</p>
                        <p className="font-mono text-xs text-on-surface-muted">
                          {TEAM_ROLE_LABEL[m.role] ?? m.role} · {m.profile.faculty ?? "Mahasiswa"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {m.profile.skills.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-outline/50">
                      {m.profile.skills.map((s) => {
                        const alreadyEndorsed =
                          user != null && s.endorsements.some((e) => e.endorserId === user.id);
                        const canEndorse = user != null && m.profileId !== user.id && !alreadyEndorsed;
                        return (
                          <div
                            key={s.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-outline bg-surface text-xs font-mono"
                          >
                            <span className="font-semibold">{s.skill.name}</span>
                            <span className="text-on-surface-muted">({s.evidenceLevel.toFixed(2)})</span>
                            {canEndorse && (
                              <form action={endorseSkillAction} className="inline-block ml-1">
                                <input type="hidden" name="projectId" value={projectId} />
                                <input type="hidden" name="profileSkillId" value={s.id} />
                                <button
                                  type="submit"
                                  className="text-primary hover:underline font-bold"
                                  title="Endorse skill rekan"
                                >
                                  + Endorse
                                </button>
                              </form>
                            )}
                            {alreadyEndorsed && <span className="text-primary font-bold">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {!isOwner && user && (
              <form action={leaveProjectAction} className="pt-2 border-t border-outline">
                <input type="hidden" name="projectId" value={projectId} />
                <button type="submit" className="md-btn md-btn-text md-btn-sm text-xs text-error hover:underline">
                  Keluar dari proyek ini
                </button>
              </form>
            )}
          </section>

          {/* Pending Applications */}
          {isOwner && pendingApplications.length > 0 && (
            <section className="md-card p-6 space-y-4">
              <div>
                <p className="eyebrow">PERMOHONAN BERGABUNG</p>
                <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                  Menunggu Keputusan ({pendingApplications.length})
                </h2>
              </div>

              <ul className="space-y-3">
                {pendingApplications.map((app) => {
                  const atLimit =
                    (applicantMembershipCounts.get(app.profileId) ?? 0) >= MAX_ACTIVE_PROJECTS;
                  return (
                    <li
                      key={app.id}
                      className="p-4 rounded-[var(--radius-xs)] border border-outline bg-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="user-dot">{initials(app.profile.fullName)}</span>
                        <div>
                          <p className="font-bold text-sm text-on-surface">{app.profile.fullName}</p>
                          <p className="font-mono text-xs text-on-surface-muted">
                            {app.profile.faculty ?? "Pelamar"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {atLimit ? (
                          <span className="font-mono text-xs text-on-surface-variant">
                            Maksimal {MAX_ACTIVE_PROJECTS} proyek aktif tercapai
                          </span>
                        ) : (
                          <form action={respondInvitationAction}>
                            <input type="hidden" name="invitationId" value={app.id} />
                            <input type="hidden" name="decision" value="ACCEPTED" />
                            <input type="hidden" name="redirectTo" value={`/projects/${projectId}/team`} />
                            <button type="submit" className="md-btn md-btn-filled md-btn-sm">
                              Terima
                            </button>
                          </form>
                        )}
                        <form action={respondInvitationAction}>
                          <input type="hidden" name="invitationId" value={app.id} />
                          <input type="hidden" name="decision" value="DECLINED" />
                          <input type="hidden" name="redirectTo" value={`/projects/${projectId}/team`} />
                          <button type="submit" className="md-btn md-btn-outlined md-btn-sm text-error">
                            Tolak
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Membership Audit Log */}
          {isOwner && auditLogs.length > 0 && (
            <section className="md-card p-6">
              <details className="group cursor-pointer">
                <summary className="flex items-center justify-between font-display text-base font-bold uppercase tracking-wider text-on-surface">
                  <span>Riwayat Keanggotaan (Audit Log)</span>
                  <span className="font-mono text-xs text-on-surface-muted group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <ul className="mt-4 space-y-2 border-t border-outline pt-3">
                  {auditLogs.map((log) => (
                    <li key={log.id} className="font-mono text-xs text-on-surface-variant">
                      {new Date(log.createdAt).toLocaleString("id-ID")} ·{" "}
                      {log.action === "TEAM_MEMBER_JOINED"
                        ? `${log.targetProfile.fullName} bergabung (dikonfirmasi ${log.actor.fullName})`
                        : `${log.targetProfile.fullName} keluar dari tim`}
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          )}
        </div>

        {/* Right Column: Radar, Recommendations, Weights */}
        <div className="space-y-6">
          <section className="md-card p-6 space-y-4">
            <div>
              <p className="eyebrow">CAKUPAN KOMPETENSI</p>
              <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                Team Radar
              </h2>
            </div>
            <TeamRadar axes={radarAxes} />
          </section>

          <section className="md-card p-6 space-y-4">
            <div>
              <p className="eyebrow">REKOMENDASI KANDIDAT</p>
              <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
                Kandidat Tercocok
              </h2>
            </div>

            {ranked.length === 0 ? (
              <p className="font-mono text-xs text-on-surface-muted text-center py-6">
                Belum ada kandidat lain yang terdaftar di katalog.
              </p>
            ) : (
              <ul className="space-y-3">
                {ranked.slice(0, 5).map((r) => {
                  const pending = pendingInviteByProfileId.get(r.candidateId);
                  const scorePct = (r.score * 100).toFixed(0);
                  return (
                    <li
                      key={r.candidateId}
                      className="p-3.5 rounded-[var(--radius-xs)] border border-outline bg-surface-container/50 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-on-surface">{nameById.get(r.candidateId)}</span>
                        <span className="font-display font-bold text-lg text-primary">
                          {scorePct}%
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {r.explanation}
                      </p>

                      {isOwner && (
                        <div className="pt-2 border-t border-outline/50 flex justify-end">
                          {pending ? (
                            <span className="font-mono text-[11px] text-on-surface-muted">
                              Undangan terkirim
                            </span>
                          ) : (
                            <form action={inviteCandidateAction}>
                              <input type="hidden" name="projectId" value={projectId} />
                              <input type="hidden" name="candidateId" value={r.candidateId} />
                              <button type="submit" className="md-btn md-btn-outlined md-btn-sm">
                                Undang ke Tim
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="md-card p-6">
            <details className="group cursor-pointer">
              <summary className="flex items-center justify-between font-display text-base font-bold uppercase tracking-wider text-on-surface">
                <span>Bobot Algoritma Matching</span>
                <span className="font-mono text-xs text-on-surface-muted group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>

              <div className="mt-4 border-t border-outline pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2 font-mono text-xs text-on-surface-variant">
                  <div className="flex justify-between border-b border-outline/30 pb-1">
                    <span>Gap Coverage:</span>
                    <strong className="text-on-surface font-bold">{(projectWeights.gapCoverage * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="flex justify-between border-b border-outline/30 pb-1">
                    <span>Availability:</span>
                    <strong className="text-on-surface font-bold">{(projectWeights.availability * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="flex justify-between border-b border-outline/30 pb-1">
                    <span>Complementarity:</span>
                    <strong className="text-on-surface font-bold">{(projectWeights.complementarity * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="flex justify-between border-b border-outline/30 pb-1">
                    <span>Interest:</span>
                    <strong className="text-on-surface font-bold">{(projectWeights.interest * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="flex justify-between border-b border-outline/30 pb-1 col-span-2">
                    <span>Experience (Maks {MAX_EXPERIENCE_WEIGHT * 100}%):</span>
                    <strong className="text-on-surface font-bold">{(projectWeights.experience * 100).toFixed(0)}%</strong>
                  </div>
                </div>

                {isOwner && (
                  <form action={updateMatchWeightsAction} className="pt-3 border-t border-outline space-y-3">
                    <input type="hidden" name="projectId" value={projectId} />
                    <p className="font-mono text-[11px] text-on-surface-muted">
                      Setel bobot relatif komponen matching (total dinormalisasi otomatis ke 1.0):
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(
                        [
                          ["gapCoverage", "Gap"],
                          ["availability", "Waktu"],
                          ["complementarity", "Komplemen"],
                          ["interest", "Minat"],
                          ["experience", "Pengalaman"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="space-y-1">
                          <span className="block font-mono text-[10px] text-on-surface-muted uppercase">{label}</span>
                          <input
                            name={key}
                            type="number"
                            step="0.05"
                            min="0"
                            max={key === "experience" ? MAX_EXPERIENCE_WEIGHT : 1}
                            defaultValue={projectWeights[key].toFixed(2)}
                            className="md-field text-center font-mono py-1 min-h-9 text-xs"
                          />
                        </label>
                      ))}
                    </div>
                    <button type="submit" className="md-btn md-btn-filled md-btn-sm w-full">
                      Simpan Bobot
                    </button>
                  </form>
                )}
              </div>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
