"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isActiveMember } from "@/lib/team-membership";
import { logActivity } from "@/lib/activity";
import { createMilestoneSchema, createTaskSchema } from "@/lib/validations/workspace";
import { noticeUrl } from "@/lib/action-notice";

// `throw` diganti `redirect` ke workspace dengan `?e=NOT_MEMBER` (audit #3):
// sebelumnya non-anggota yang mencoba memanggil action ini lewat DevTools
// mendarat di error.tsx generik, bukan pesan yang menjelaskan kenapa.
async function requireMember(projectId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await isActiveMember(projectId, user.id))) {
    redirect(noticeUrl(`/projects/${projectId}/workspace`, "NOT_MEMBER"));
  }
  return user.id;
}

export async function createMilestoneAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId"));
  const profileId = await requireMember(projectId);
  const workspacePath = `/projects/${projectId}/workspace`;

  const parsed = createMilestoneSchema.safeParse({
    title: formData.get("title"),
    deadline: formData.get("deadline"),
    weight: formData.get("weight") || 1,
  });
  if (!parsed.success) redirect(noticeUrl(workspacePath, "MILESTONE_INVALID"));

  await prisma.milestone.create({
    data: {
      projectId,
      ownerId: profileId,
      title: parsed.data.title,
      deadline: new Date(parsed.data.deadline),
      weight: parsed.data.weight,
    },
  });

  revalidatePath(workspacePath);
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const milestoneId = String(formData.get("milestoneId"));
  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) redirect(noticeUrl("/projects", "MILESTONE_NOT_FOUND"));
  await requireMember(milestone.projectId);
  const workspacePath = `/projects/${milestone.projectId}/workspace`;

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    priority: formData.get("priority") || "MEDIUM",
    weight: formData.get("weight") || 1,
    assigneeId: formData.get("assigneeId"),
  });
  if (!parsed.success) redirect(noticeUrl(workspacePath, "TASK_INVALID"));

  await prisma.task.create({
    data: {
      milestoneId,
      title: parsed.data.title,
      priority: parsed.data.priority,
      weight: parsed.data.weight,
      assigneeId: parsed.data.assigneeId || null,
    },
  });

  revalidatePath(workspacePath);
}

// DONE SENGAJA TIDAK ADA di sini — anti-gaming Blueprint Bagian 08
// Masalah 2: "task selesai butuh penanda kedua". Anggota mana pun bisa
// gerakkan task bebas antar TODO/IN_PROGRESS/PENDING_CONFIRM (menandai
// "menurutku sudah selesai"), tapi DONE sungguhan cuma tercapai lewat
// confirmTaskAction di bawah, oleh owner/milestone-owner — bukan lewat
// action ini, bukan oleh assignee sendiri.
const TASK_STATUSES = ["TODO", "IN_PROGRESS", "PENDING_CONFIRM"] as const;

export async function setTaskStatusAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId"));
  const status = String(formData.get("status"));
  if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
    redirect(noticeUrl("/projects", "TASK_STATUS_INVALID"));
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { milestone: true },
  });
  if (!task) redirect(noticeUrl("/projects", "MILESTONE_NOT_FOUND"));
  const workspacePath = `/projects/${task.milestone.projectId}/workspace`;
  // Task yang sudah DONE (dikonfirmasi) tidak bisa digeser lagi dari sini —
  // kalau perlu dibuka lagi, itu keputusan sadar, bukan drag-and-drop biasa.
  if (task.status === "DONE") redirect(noticeUrl(workspacePath, "TASK_STATUS_INVALID"));
  await requireMember(task.milestone.projectId);

  await prisma.task.update({
    where: { id: taskId },
    data: { status: status as (typeof TASK_STATUSES)[number] },
  });

  revalidatePath(workspacePath);
}

// Penanda KEDUA (anti-gaming Bagian 08) — satu-satunya jalan Task benar-
// benar jadi DONE dan Activity(TASK_SELESAI) tercatat. Otorisasi: owner
// proyek ATAU owner milestone task ini (bukan assignee sendiri, bukan
// anggota lain) — pola yang sama dengan penerima alert MILESTONE_LATE
// (owner + pemilik milestone).
export async function confirmTaskAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId"));

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { milestone: { include: { project: true } } },
  });
  if (!task) redirect(noticeUrl("/projects", "MILESTONE_NOT_FOUND"));
  const workspacePath = `/projects/${task.milestone.projectId}/workspace`;
  if (task.status !== "PENDING_CONFIRM") redirect(noticeUrl(workspacePath, "TASK_CONFIRM_INVALID"));

  const profileId = await requireMember(task.milestone.projectId);
  const isAuthorized =
    profileId === task.milestone.project.ownerId || profileId === task.milestone.ownerId;
  if (!isAuthorized) redirect(noticeUrl(workspacePath, "TASK_CONFIRM_NOT_AUTHORIZED"));

  await prisma.task.update({ where: { id: taskId }, data: { status: "DONE" } });
  await logActivity({
    projectId: task.milestone.projectId,
    actorId: profileId,
    eventType: "TASK_SELESAI",
  });

  revalidatePath(workspacePath);
}

export async function completeMilestoneAction(formData: FormData): Promise<void> {
  const milestoneId = String(formData.get("milestoneId"));
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { project: true },
  });
  if (!milestone) redirect(noticeUrl("/projects", "MILESTONE_NOT_FOUND"));
  const workspacePath = `/projects/${milestone.projectId}/workspace`;
  const profileId = await requireMember(milestone.projectId);
  // T7 (audit UI/UX): sebelumnya anggota mana pun bisa menyelesaikan
  // milestone siapa pun — tidak simetris dengan confirmTaskAction yang
  // sudah membatasi ke owner proyek/pemilik milestone. Disamakan di sini.
  const isAuthorized = profileId === milestone.project.ownerId || profileId === milestone.ownerId;
  if (!isAuthorized) redirect(noticeUrl(workspacePath, "COMPLETE_MILESTONE_NOT_AUTHORIZED"));

  await prisma.milestone.update({ where: { id: milestoneId }, data: { status: "DONE" } });
  await logActivity({
    projectId: milestone.projectId,
    actorId: profileId,
    eventType: "MILESTONE_SELESAI",
  });

  revalidatePath(workspacePath);
}
