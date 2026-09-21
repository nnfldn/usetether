"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, limitFromEnv } from "@/lib/rate-limit";
import { peerRatingSchema } from "@/lib/validations/peer-rating";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return user.id;
}

export type PeerRatingState = { error: string | null; ok?: boolean };

/**
 * Menyimpan penilaian rekan satu tim. Mengisi komponen peer_rating_norm
 * (bobot 0.3) pada rumus Experience — lihat src/lib/matching/experience.ts.
 *
 * Empat pagar otorisasi, semuanya di lapisan logika (bukan disembunyikan di
 * UI), sesuai checklist keamanan Blueprint Bagian 09:
 *   1. Proyek harus sudah COMPLETED — menilai di tengah jalan membuka pintu
 *      tekanan sosial saat kerja masih berlangsung.
 *   2. Penilai harus anggota aktif proyek itu.
 *   3. Yang dinilai harus anggota aktif proyek yang SAMA.
 *   4. Tidak boleh menilai diri sendiri.
 * Pagar 1 dan 4 juga ditegakkan CHECK constraint di database.
 */
export async function submitPeerRatingAction(
  _prev: PeerRatingState,
  formData: FormData,
): Promise<PeerRatingState> {
  const userId = await requireUserId();

  const parsed = peerRatingSchema.safeParse({
    projectId: formData.get("projectId"),
    ratedId: formData.get("ratedId"),
    timeliness: formData.get("timeliness"),
    quality: formData.get("quality"),
    communication: formData.get("communication"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nilai tidak valid" };
  }
  const { projectId, ratedId, timeliness, quality, communication } = parsed.data;

  if (ratedId === userId) {
    return { error: "Tidak bisa menilai diri sendiri." };
  }

  // Dikunci per userId, bukan IP — aksi ini sudah butuh sesi login.
  if (!checkRateLimit(`peer-rating:${userId}`, limitFromEnv("RATE_LIMIT_PEER_RATING", 40), 60 * 60 * 1000)) {
    return { error: "Terlalu banyak penilaian dalam waktu singkat. Coba lagi nanti." };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });
  if (!project) return { error: "Proyek tidak ditemukan." };
  if (project.status !== "COMPLETED") {
    return { error: "Penilaian rekan hanya bisa diberikan setelah proyek ditutup." };
  }

  // Penilai DAN yang dinilai harus sama-sama anggota aktif proyek ini.
  // Diambil sekali dalam satu query supaya tidak ada celah waktu di antara
  // dua pemeriksaan terpisah.
  const anggota = await prisma.teamMember.findMany({
    where: { team: { projectId }, status: "ACTIVE", profileId: { in: [userId, ratedId] } },
    select: { profileId: true },
  });
  const ids = new Set(anggota.map((a) => a.profileId));
  if (!ids.has(userId)) return { error: "Kamu bukan anggota proyek ini." };
  if (!ids.has(ratedId)) return { error: "Orang itu bukan anggota proyek ini." };

  // upsert, bukan create: mengubah penilaian yang sudah diberikan itu wajar
  // (dan @@unique memang melarang baris kedua). Yang dilarang adalah
  // MENAMBAH baris untuk menggeser rata-rata — itu tetap tidak mungkin.
  await prisma.peerRating.upsert({
    where: {
      projectId_raterId_ratedId: { projectId, raterId: userId, ratedId },
    },
    create: { projectId, raterId: userId, ratedId, timeliness, quality, communication },
    update: { timeliness, quality, communication },
  });

  revalidatePath(`/projects/${projectId}`);
  return { error: null, ok: true };
}
