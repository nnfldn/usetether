import { prisma } from "@/lib/prisma";

// Pemeriksaan otorisasi tingkat objek dipakai berulang di modul workspace —
// checklist keamanan Blueprint Bagian 09 mensyaratkan ini ADA di lapisan
// logika (bukan cuma disembunyikan di UI), jadi disatukan di sini supaya
// tidak ditulis ulang beda-beda tiap Server Action.
export async function isActiveMember(projectId: string, profileId: string): Promise<boolean> {
  const member = await prisma.teamMember.findFirst({
    where: { team: { projectId }, profileId, status: "ACTIVE" },
    select: { id: true },
  });
  return member !== null;
}

// Pemeriksaan akses gabungan (owner ATAU anggota aktif) dipakai buat menggate
// RENDER halaman workspace/tim/kesehatan — bukan cuma aksi tulis. Ditemukan
// 31 Agustus malam: ketiga sub-halaman proyek sempat merender data privat
// (radar, kandidat, milestone/task, indikator kesehatan) ke SIAPA PUN yang
// login, bukan cuma anggota tim proyek itu — melanggar keputusan privasi
// eksplisit Blueprint ("workspace privat", "data kesehatan hanya anggota
// tim"). Data publik proyek (judul/goal/tag/deadline/requirement) TIDAK
// pakai pemeriksaan ini — itu memang sengaja publik untuk penemuan proyek.
export async function getViewerAccess(
  projectId: string,
  viewerId: string | undefined,
): Promise<{ isOwner: boolean; isMember: boolean }> {
  if (!viewerId) return { isOwner: false, isMember: false };
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project) return { isOwner: false, isMember: false };
  let isOwner = project.ownerId === viewerId;
  let isMember = isOwner;

  const member = await prisma.teamMember.findFirst({
    where: { team: { projectId }, profileId: viewerId, status: "ACTIVE" },
    select: { role: true },
  });

  if (member) {
    isMember = true;
    if (member.role === "Owner" || member.role === "owner") {
      isOwner = true;
    }
  }

  return { isOwner, isMember };
}
