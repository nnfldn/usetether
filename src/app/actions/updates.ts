"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isActiveMember } from "@/lib/team-membership";
import { logThrottledActivity } from "@/lib/activity";
import { postProgressUpdateSchema } from "@/lib/validations/workspace";
import { noticeUrl } from "@/lib/action-notice";

// Fitur must-have #10 Blueprint ("progress update & activity log") — narasi
// singkat status proyek dari anggota tim mana pun, terpisah dari perubahan
// status milestone/task otomatis yang sudah dicatat di workspace.ts.
export async function postProgressUpdateAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId"));
  const overviewPath = `/projects/${projectId}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  // Otorisasi tingkat objek: hanya anggota aktif proyek ini (owner sudah
  // otomatis jadi anggota pertama saat proyek dibuat) yang boleh posting.
  if (!(await isActiveMember(projectId, user.id))) {
    redirect(noticeUrl(overviewPath, "NOT_MEMBER"));
  }

  const parsed = postProgressUpdateSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) redirect(noticeUrl(overviewPath, "UPDATE_INVALID"));

  await prisma.progressUpdate.create({
    data: {
      projectId,
      authorId: user.id,
      body: parsed.data.body,
    },
  });

  // Cooldown 1 jam per anggota per proyek (anti-gaming Bagian 08) — teks di
  // atas SELALU tersimpan, cuma bobot Activity-nya yang dibatasi.
  await logThrottledActivity({
    projectId,
    actorId: user.id,
    eventType: "PROGRESS_UPDATE",
  });

  revalidatePath(`/projects/${projectId}`);
}
