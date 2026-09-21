"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  createProjectSchema,
  requirementRowSchema,
  updateMatchWeightsSchema,
  MAX_ACTIVE_PROJECTS,
} from "@/lib/validations/project";
import { sanitizeWeights } from "@/lib/matching/score";
import { noticeUrl } from "@/lib/action-notice";

export type ProjectActionState = { error: string | null };

export async function createProjectAction(
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Keputusan #4 Lampiran C: batas wajar proyek aktif sekaligus, supaya
  // satu orang tidak mendaftar jadi anggota puluhan proyek sekaligus (yang
  // di praktiknya cuma bikin komitmennya tidak berarti di manapun).
  const activeMemberships = await prisma.teamMember.count({
    where: { profileId: user.id, status: "ACTIVE" },
  });
  if (activeMemberships >= MAX_ACTIVE_PROJECTS) {
    return { error: `Kamu sudah aktif di ${MAX_ACTIVE_PROJECTS} proyek. Selesaikan atau tinggalkan salah satu dulu sebelum membuat proyek baru.` };
  }

  const parsed = createProjectSchema.safeParse({
    title: formData.get("title"),
    goal: formData.get("goal"),
    tags: formData.get("tags"),
    deadline: formData.get("deadline"),
    visibility: formData.get("visibility") || "PUBLIC",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const skillNames = formData.getAll("reqSkill").map(String);
  const importances = formData.getAll("reqImportance").map(String);
  const requirementRows = skillNames
    .map((skillName, i) =>
      requirementRowSchema.safeParse({ skillName, importance: importances[i] }),
    )
    .filter((r) => r.success)
    .map((r) => r.data!)
    // requirementRowSchema hanya validasi bentuk data, filter baris kosong
    // (skillName kosong dari row yang ditambah tapi tidak diisi) di sini.
    .filter((r) => r.skillName.length > 0);

  const tags = (parsed.data.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        ownerId: user.id,
        title: parsed.data.title,
        goal: parsed.data.goal,
        tags,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
        visibility: parsed.data.visibility,
        status: "ACTIVE",
      },
    });

    for (const row of requirementRows) {
      const skill = await tx.skill.upsert({
        where: { name: row.skillName },
        create: { name: row.skillName },
        update: {},
      });
      await tx.requirement.create({
        data: { projectId: created.id, skillId: skill.id, importance: row.importance },
      });
    }

    // Owner otomatis jadi anggota pertama tim (ROADMAP.md milestone 2.4).
    await tx.team.create({
      data: {
        projectId: created.id,
        members: { create: { profileId: user.id, role: "Owner" } },
      },
    });

    return created;
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

// Keputusan #6 Lampiran C + Blueprint Bagian 05 ("bobot dapat diubah oleh
// project owner"). Yang DISIMPAN adalah angka mentah dari owner setelah
// dinormalisasi lewat sanitizeWeights — jadi cap anti-bias Experience
// 0.15 sudah ikut tersimpan, bukan cuma diterapkan saat menghitung.
export async function updateProjectAction(
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const projectId = String(formData.get("projectId"));
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== user.id) {
    return { error: "Hanya pemilik proyek yang bisa mengubah proyek" };
  }

  const parsed = createProjectSchema.safeParse({
    title: formData.get("title"),
    goal: formData.get("goal"),
    tags: formData.get("tags"),
    deadline: formData.get("deadline"),
    visibility: formData.get("visibility") || "PUBLIC",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const tags = (parsed.data.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      title: parsed.data.title,
      goal: parsed.data.goal,
      tags,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      visibility: parsed.data.visibility,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  return { error: null };
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const projectId = String(formData.get("projectId"));
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  
  // Otorisasi ketat tingkat objek: HANYA owner yang boleh hapus
  if (!project || project.ownerId !== user.id) {
    redirect(noticeUrl(`/projects/${projectId}`, "DELETE_NOT_ALLOWED"));
  }

  await prisma.project.delete({
    where: { id: projectId },
  });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateMatchWeightsAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const projectId = String(formData.get("projectId"));
  const teamPath = `/projects/${projectId}/team`;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== user.id) redirect(noticeUrl(teamPath, "WEIGHTS_NOT_OWNER")); // owner-only

  const parsed = updateMatchWeightsSchema.safeParse({
    gapCoverage: formData.get("gapCoverage"),
    availability: formData.get("availability"),
    complementarity: formData.get("complementarity"),
    interest: formData.get("interest"),
    experience: formData.get("experience"),
  });
  if (!parsed.success) redirect(noticeUrl(teamPath, "WEIGHTS_INVALID"));

  const w = sanitizeWeights(parsed.data);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      weightGapCoverage: w.gapCoverage,
      weightAvailability: w.availability,
      weightComplementarity: w.complementarity,
      weightInterest: w.interest,
      weightExperience: w.experience,
    },
  });

  revalidatePath(`/projects/${projectId}/team`);
}

const PROJECT_COMPLETION_LEVEL = 1.0;

// Fase "Complete" dari kerangka 4C Tether (Connect-Compose-Collaborate-
// Complete) — sebelum ini TIDAK ADA jalan sama sekali untuk menutup
// proyek, ditemukan & dibangun 1 September. Owner-only (otorisasi tingkat
// objek, bukan cuma disembunyikan di UI). Menutup proyek MEMICU jenjang
// bukti skill tertinggi (Blueprint Bagian 08, 1.00): tiap anggota aktif
// naik ke 1.00 HANYA untuk skill yang memang jadi Requirement proyek ini
// (skill yang benar-benar dipakai menyelesaikan proyek), bukan seluruh
// skill di profil mereka — supaya upgrade ini tetap berarti sesuatu, bukan
// hadiah gratis lintas skill yang tidak relevan.
export async function completeProjectAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const projectId = String(formData.get("projectId"));
  const overviewPath = `/projects/${projectId}`;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== user.id || project.status === "COMPLETED") {
    redirect(noticeUrl(overviewPath, "COMPLETE_NOT_ALLOWED"));
  }

  const [requirements, activeMembers] = await Promise.all([
    prisma.requirement.findMany({ where: { projectId }, select: { skillId: true } }),
    prisma.teamMember.findMany({
      where: { team: { projectId }, status: "ACTIVE" },
      select: { profileId: true },
    }),
  ]);
  const requiredSkillIds = requirements.map((r) => r.skillId);

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { status: "COMPLETED" } });

    if (requiredSkillIds.length > 0 && activeMembers.length > 0) {
      // Baca-lalu-tulis per baris (bukan raw SQL) — skala kecil (anggota
      // aktif x skill requirement proyek ini), Math.max di TS supaya
      // tidak pernah menurunkan level yang sudah 1.00 atau lebih tinggi.
      // Anggota yang tidak pernah mengklaim skill itu di profilnya
      // sengaja TIDAK dapat baris baru dibuat di sini — upgrade hanya
      // berlaku untuk skill yang memang sudah mereka klaim sendiri.
      const toUpgrade = await tx.profileSkill.findMany({
        where: {
          profileId: { in: activeMembers.map((m) => m.profileId) },
          skillId: { in: requiredSkillIds },
          evidenceLevel: { lt: PROJECT_COMPLETION_LEVEL },
        },
        select: { id: true },
      });
      if (toUpgrade.length > 0) {
        await tx.profileSkill.updateMany({
          where: { id: { in: toUpgrade.map((r) => r.id) } },
          data: { evidenceLevel: PROJECT_COMPLETION_LEVEL },
        });
      }
    }
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/profile");
}
