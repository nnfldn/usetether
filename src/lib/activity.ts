import { prisma } from "@/lib/prisma";
import type { ActivityEventType } from "@/generated/prisma/client";

// Bobot per jenis peristiwa — Blueprint Bagian 07. Satu-satunya tempat nilai
// ini ditulis; cron kesehatan (Fase 5) dan modul workspace (Fase 4) sama-sama
// merujuk ke sini supaya tidak pernah berbeda.
export const EVENT_WEIGHTS: Record<ActivityEventType, number> = {
  MILESTONE_SELESAI: 5,
  TASK_SELESAI: 3,
  PROGRESS_UPDATE: 2,
  FILE_COMMIT: 2,
  DISKUSI_BERMAKNA: 1,
};

// MILESTONE_SELESAI dan TASK_SELESAI sudah dijaga alami oleh transisi status
// (tidak bisa diselesaikan dua kali), lihat completeTaskAction/
// completeMilestoneAction — tidak butuh cooldown terpisah.
export async function logActivity(input: {
  projectId: string;
  actorId: string;
  eventType: ActivityEventType;
}) {
  await prisma.activity.create({
    data: {
      projectId: input.projectId,
      actorId: input.actorId,
      eventType: input.eventType,
      weight: EVENT_WEIGHTS[input.eventType],
    },
  });
}

const ONE_HOUR_MS = 60 * 60 * 1000;

// Cooldown per jenis peristiwa (Blueprint Bagian 08 anti-gaming): "10
// update/jam dihitung sebagai satu" — dipakai untuk jenis peristiwa yang
// bisa diulang bebas oleh pengguna (PROGRESS_UPDATE, nanti DISKUSI_BERMAKNA).
// Kontennya (ProgressUpdate.body) TETAP tersimpan penuh di luar fungsi ini
// terlepas dari cooldown — yang dibatasi cuma bobot Activity-nya, supaya
// spam teks tidak bisa menggelembungkan skor Pulse secara artifisial.
export async function logThrottledActivity(input: {
  projectId: string;
  actorId: string;
  eventType: ActivityEventType;
  cooldownMs?: number;
}): Promise<boolean> {
  const cooldownMs = input.cooldownMs ?? ONE_HOUR_MS;
  const recent = await prisma.activity.findFirst({
    where: {
      projectId: input.projectId,
      actorId: input.actorId,
      eventType: input.eventType,
      createdAt: { gte: new Date(Date.now() - cooldownMs) },
    },
    select: { id: true },
  });
  if (recent) return false;
  await logActivity(input);
  return true;
}
