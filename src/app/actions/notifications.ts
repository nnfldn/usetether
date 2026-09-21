"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return user.id;
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id"));
  // where menyertakan profileId -> tidak bisa tandai notifikasi milik
  // orang lain lewat id yang ditebak (otorisasi tingkat objek).
  await prisma.notification.updateMany({
    where: { id, profileId: userId },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const userId = await requireUserId();
  await prisma.notification.updateMany({
    where: { profileId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
