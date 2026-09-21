import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getViewerAccess } from "@/lib/team-membership";
import { SubmitButton } from "@/components/submit-button";
import { ActionNotice } from "@/components/action-notice";
import {
  createMilestoneAction,
  createTaskAction,
  setTaskStatusAction,
  confirmTaskAction,
  completeMilestoneAction,
} from "@/app/actions/workspace";
import { MILESTONE_STATUS_LABEL, TASK_PRIORITY_LABEL } from "@/lib/labels";

const MOVABLE_COLUMNS = [
  { status: "TODO", label: "To Do" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "PENDING_CONFIRM", label: "Menunggu Konfirmasi" },
] as const;
const COLUMNS = [...MOVABLE_COLUMNS, { status: "DONE", label: "Selesai" }] as const;

export default async function ProjectWorkspacePage({
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
  const { isMember, isOwner } = await getViewerAccess(projectId, user?.id);
  if (!isMember) {
    return (
      <div className="md-card p-8 text-center text-sm text-on-surface-variant">
        Konten ruang kerja privat untuk anggota tim proyek ini.
      </div>
    );
  }

  const [milestones, members] = await Promise.all([
    prisma.milestone.findMany({
      where: { projectId },
      orderBy: { deadline: "asc" },
      include: { tasks: { include: { assignee: true } } },
    }),
    prisma.teamMember.findMany({
      where: { team: { projectId }, status: "ACTIVE" },
      include: { profile: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <ActionNotice code={noticeCode} />

      {/* Owner Action: Add Milestone */}
      {isOwner && (
        <div className="md-card p-5">
          <details className="group cursor-pointer">
            <summary className="flex items-center justify-between font-display text-base font-bold uppercase tracking-wider text-on-surface">
              <span>＋ Buat Milestone Baru</span>
              <span className="font-mono text-xs text-on-surface-muted group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <form
              action={createMilestoneAction}
              className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-end border-t border-outline pt-4"
            >
              <input type="hidden" name="projectId" value={projectId} />
              <div className="space-y-1.5">
                <label
                  htmlFor="milestone-title"
                  className="block font-mono text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold"
                >
                  Nama Milestone
                </label>
                <input
                  id="milestone-title"
                  name="title"
                  required
                  minLength={3}
                  maxLength={140}
                  placeholder="mis. Validasi Masalah & Riset"
                  className="md-field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="milestone-deadline"
                  className="block font-mono text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold"
                >
                  Tenggat
                </label>
                <input
                  id="milestone-deadline"
                  name="deadline"
                  type="date"
                  required
                  className="md-field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="milestone-weight"
                  className="block font-mono text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold"
                >
                  Bobot (1-20)
                </label>
                <input
                  id="milestone-weight"
                  name="weight"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={3}
                  className="md-field text-center font-mono"
                />
              </div>
              <SubmitButton className="md-btn md-btn-filled" pendingLabel="Menyimpan...">
                Simpan Milestone
              </SubmitButton>
            </form>
          </details>
        </div>
      )}

      {/* Milestones List */}
      {milestones.length === 0 ? (
        <div className="md-card p-12 text-center space-y-2">
          <p className="font-mono text-sm text-on-surface-muted">
            Belum ada milestone yang dibuat untuk proyek ini.
          </p>
          {isOwner && (
            <p className="text-xs text-on-surface-variant">
              Gunakan form di atas untuk menentukan tahapan target utama tim.
            </p>
          )}
        </div>
      ) : (
        milestones.map((m, idx) => {
          const canManageMilestone = isOwner || user?.id === m.ownerId;
          const allTasksDone = m.tasks.length > 0 && m.tasks.every((t) => t.status === "DONE");

          return (
            <div key={m.id} className="md-card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline pb-4">
                <div>
                  <p className="eyebrow">MILESTONE {String(idx + 1).padStart(2, "0")}</p>
                  <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface mt-0.5">
                    {m.title}
                  </h2>
                  <p className="font-mono text-xs text-on-surface-muted mt-1">
                    Tenggat: {new Date(m.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} · Bobot: {m.weight} poin
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs uppercase font-bold px-2.5 py-0.5 rounded-full border border-outline bg-surface-container text-primary">
                    {MILESTONE_STATUS_LABEL[m.status] ?? m.status}
                  </span>
                  {m.status !== "DONE" && canManageMilestone && (
                    <form action={completeMilestoneAction}>
                      <input type="hidden" name="milestoneId" value={m.id} />
                      <button
                        type="submit"
                        className="md-btn md-btn-outlined md-btn-sm"
                        title={allTasksDone ? "Semua task selesai" : "Selesaikan milestone ini"}
                      >
                        Selesaikan Milestone
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Kanban 4 Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
                {COLUMNS.map((col) => {
                  const tasksInColumn = m.tasks.filter((t) => t.status === col.status);
                  return (
                    <div
                      key={col.status}
                      className="p-3.5 rounded-[var(--radius-xs)] border border-outline bg-surface-container/40 flex flex-col justify-between min-h-[220px]"
                    >
                      <div className="space-y-3">
                        <header className="flex items-center justify-between border-b border-outline/60 pb-2">
                          <span className="font-display text-sm font-bold uppercase tracking-wider text-on-surface">
                            {col.label}
                          </span>
                          <span className="font-mono text-xs font-bold text-on-surface-muted px-1.5 py-0.5 rounded bg-surface-container-high">
                            {tasksInColumn.length}
                          </span>
                        </header>

                        <div className="space-y-2.5">
                          {tasksInColumn.map((t) => (
                            <div
                              key={t.id}
                              className="p-3 rounded-[var(--radius-xs)] border border-outline bg-surface space-y-2"
                            >
                              <div className="flex items-center justify-between gap-1 text-[11px]">
                                <span className="font-mono font-semibold uppercase text-primary">
                                  {TASK_PRIORITY_LABEL[t.priority] ?? t.priority}
                                </span>
                                {col.status !== "DONE" && (
                                  <div className="flex items-center gap-1">
                                    {MOVABLE_COLUMNS.filter((c) => c.status !== col.status).map((target) => (
                                      <form key={target.status} action={setTaskStatusAction}>
                                        <input type="hidden" name="taskId" value={t.id} />
                                        <input type="hidden" name="status" value={target.status} />
                                        <button
                                          type="submit"
                                          aria-label={`Pindahkan ke ${target.label}`}
                                          title={`Pindahkan ke ${target.label}`}
                                          className="px-1.5 py-0.5 font-mono text-[10px] rounded border border-outline hover:bg-surface-container text-on-surface-variant"
                                        >
                                          → {target.label.slice(0, 4)}
                                        </button>
                                      </form>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <p className="font-semibold text-xs text-on-surface leading-tight">
                                {t.title}
                              </p>

                              <p className="font-mono text-[10px] text-on-surface-muted">
                                {t.assignee ? t.assignee.fullName : "Tanpa PIC"} · Bobot {t.weight}
                              </p>

                              {col.status === "PENDING_CONFIRM" && canManageMilestone && (
                                <form action={confirmTaskAction} className="pt-2 border-t border-outline/50">
                                  <input type="hidden" name="taskId" value={t.id} />
                                  <button
                                    type="submit"
                                    className="md-btn md-btn-filled md-btn-sm w-full text-xs"
                                  >
                                    ✓ Konfirmasi Selesai
                                  </button>
                                </form>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Add Task inside TODO */}
                      {col.status === "TODO" && (
                        <details className="group mt-3 pt-2 border-t border-outline/40">
                          <summary className="cursor-pointer font-mono text-xs font-semibold text-primary hover:underline">
                            ＋ Tambah Task
                          </summary>
                          <form action={createTaskAction} className="mt-2.5 space-y-2">
                            <input type="hidden" name="milestoneId" value={m.id} />
                            <input
                              name="title"
                              placeholder="Deskripsi task baru..."
                              required
                              minLength={3}
                              maxLength={140}
                              className="md-field text-xs py-1.5 min-h-9"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select name="priority" defaultValue="MEDIUM" className="md-field text-xs py-1 min-h-9">
                                <option value="LOW">Prioritas Rendah</option>
                                <option value="MEDIUM">Prioritas Sedang</option>
                                <option value="HIGH">Prioritas Tinggi</option>
                              </select>
                              <select name="assigneeId" defaultValue="" className="md-field text-xs py-1 min-h-9">
                                <option value="">Tanpa PIC</option>
                                {members.map((mem) => (
                                  <option key={mem.profileId} value={mem.profileId}>
                                    {mem.profile.fullName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <SubmitButton className="md-btn md-btn-filled md-btn-sm w-full" pendingLabel="Menyimpan...">
                              Simpan Task
                            </SubmitButton>
                          </form>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
