"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  updateProfileSchema,
  addSkillSchema,
  availabilitySlotSchema,
} from "@/lib/validations/profile";

export type ProfileActionState = { error: string | null };

async function requireProfileId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return user.id;
}

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const profileId = await requireProfileId();

  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    faculty: formData.get("faculty"),
    bio: formData.get("bio"),
    interests: formData.get("interests"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const interests = (parsed.data.interests ?? "")
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean);

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      fullName: parsed.data.fullName,
      faculty: parsed.data.faculty || null,
      bio: parsed.data.bio || null,
      interests,
    },
  });

  revalidatePath("/profile");
  redirect("/profile");
}

// Level bukti skill (Blueprint Bagian 08) SENGAJA tidak bisa dipilih bebas
// oleh pengguna — dihitung server-side dari bukti yang benar-benar ada.
// Cuma dua jenjang PALING BAWAH yang bisa dicapai lewat form ini sendiri;
// 0.80 (endorsement rekan) naik lewat endorseSkillAction (team.ts) dan 1.00
// (proyek selesai) naik lewat completeProjectAction (projects.ts) — dua
// jenjang atas itu TIDAK PERNAH dipilih pengguna sendiri di sini.
function computeSelfClaimedLevel(portfolioUrl: string | undefined): number {
  return portfolioUrl ? 0.65 : 0.5;
}

export async function addSkillAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const profileId = await requireProfileId();

  const parsed = addSkillSchema.safeParse({
    skillName: formData.get("skillName"),
    portfolioUrl: formData.get("portfolioUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const portfolioUrl = parsed.data.portfolioUrl || undefined;
  const selfClaimedLevel = computeSelfClaimedLevel(portfolioUrl);

  const skill = await prisma.skill.upsert({
    where: { name: parsed.data.skillName },
    create: { name: parsed.data.skillName },
    update: {},
  });

  // Math.max terhadap level yang sudah ada — WAJIB, bukan sekadar hati-hati.
  // Tanpa ini, mengedit skill (mis. cuma menambah portofolio) akan menimpa
  // evidenceLevel 0.80/1.00 yang sudah dicapai lewat endorsement/proyek
  // selesai balik ke 0.65 — regresi nyata yang ditemukan & diperbaiki 1
  // September saat fitur endorsement dibangun.
  const existing = await prisma.profileSkill.findUnique({
    where: { profileId_skillId: { profileId, skillId: skill.id } },
    select: { evidenceLevel: true },
  });
  const evidenceLevel = Math.max(existing?.evidenceLevel ?? 0, selfClaimedLevel);

  await prisma.profileSkill.upsert({
    where: { profileId_skillId: { profileId, skillId: skill.id } },
    create: { profileId, skillId: skill.id, evidenceLevel, portfolioUrl },
    update: { evidenceLevel, portfolioUrl },
  });

  revalidatePath("/profile");
  return { error: null };
}

export async function removeSkillAction(formData: FormData): Promise<void> {
  const profileId = await requireProfileId();
  const profileSkillId = formData.get("profileSkillId");
  if (typeof profileSkillId !== "string") return;

  // where menyertakan profileId -> tidak bisa hapus milik profil lain lewat
  // id yang ditebak/dimanipulasi.
  await prisma.profileSkill.deleteMany({
    where: { id: profileSkillId, profileId },
  });

  revalidatePath("/profile");
}

// Mengganti SELURUH slot ketersediaan sekaligus (hapus lalu buat ulang dari
// checkbox yang dicentang) — lebih sederhana & tanpa risiko duplikat
// dibanding tambah/hapus satu-satu, cocok untuk bentuk input grid hari x blok.
export async function setAvailabilityAction(formData: FormData): Promise<void> {
  const profileId = await requireProfileId();

  const raw = formData.getAll("slot"); // format "dayOfWeek-block", mis. "1-SORE"
  const slots = raw
    .map((v) => String(v).split("-"))
    .map(([dayOfWeek, block]) =>
      availabilitySlotSchema.safeParse({ dayOfWeek, block }),
    )
    .filter((r) => r.success)
    .map((r) => r.data!);

  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { profileId } }),
    prisma.availability.createMany({
      data: slots.map((s) => ({ profileId, ...s })),
    }),
  ]);

  revalidatePath("/profile");
  redirect("/profile");
}
