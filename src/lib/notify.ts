import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/client";

// Satu-satunya tempat Notification dibuat — dipanggil dari Server Action
// (team.ts, untuk undangan/lamaran/respons) dan cron harian (health-alert
// -> HEALTH_ALERT). Sengaja fungsi tipis tanpa logika tambahan, supaya
// pemanggilnya tetap yang menentukan KAPAN & UNTUK SIAPA — fungsi ini cuma
// menulis baris.
export async function notify(
  profileId: string,
  type: NotificationType,
  message: string,
  projectId?: string,
): Promise<void> {
  await prisma.notification.create({ data: { profileId, type, message, projectId } });
}
