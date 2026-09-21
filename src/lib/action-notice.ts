// Audit #3 ("gagal diam-diam"): sebelum ini, banyak Server Action `return`
// begitu saja saat menolak — bukan anggota, kena rate limit, sudah mentok
// batas, dsb. Di layar itu tidak bisa dibedakan dari tombol yang rusak.
//
// Aturan yang ditegakkan sekarang: tiap penolakan yang TIDAK sudah
// dijelaskan lewat UI (tombol disembunyikan/pesan statis di halaman) harus
// redirect ke halaman asal dengan `?e=KODE`, dibaca oleh <ActionNotice/>.
// Kode di bawah dikelompokkan per Server Action sumbernya.
export const ACTION_NOTICE_MESSAGES = {
  // team.ts — inviteCandidateAction
  INVITE_NOT_OWNER: "Hanya pemilik proyek yang bisa mengundang kandidat.",
  INVITE_RATE_LIMIT: "Terlalu banyak undangan dikirim dalam waktu singkat. Coba lagi nanti.",
  INVITE_DUP: "Kandidat ini sudah diundang dan belum merespons.",
  // team.ts — applyCandidateAction
  PROJECT_NOT_FOUND: "Proyek tidak ditemukan — mungkin sudah dihapus.",
  APPLY_IS_OWNER: "Kamu pemilik proyek ini, tidak bisa melamar ke proyekmu sendiri.",
  APPLY_ALREADY_MEMBER: "Kamu sudah jadi anggota aktif proyek ini.",
  APPLY_RATE_LIMIT: "Terlalu banyak lamaran dikirim dalam waktu singkat. Coba lagi nanti.",
  APPLY_DUP: "Kamu sudah melamar dan masih menunggu respons owner.",
  // team.ts — respondInvitationAction
  INVITATION_INVALID: "Pilihan tidak valid.",
  INVITATION_GONE: "Undangan/lamaran ini sudah tidak berlaku — mungkin sudah direspons sebelumnya.",
  INVITATION_NOT_AUTHORIZED: "Kamu tidak berwenang merespons undangan ini.",
  INVITATION_AT_LIMIT: "Kandidat ini sudah aktif di batas maksimum proyek, tidak bisa diterima sekarang.",
  // team.ts — endorseSkillAction
  SKILL_NOT_FOUND: "Skill ini tidak ditemukan.",
  ENDORSE_SELF: "Tidak bisa endorse skill milik sendiri.",
  ENDORSE_NOT_MEMBER: "Endorsement hanya berlaku antar anggota aktif proyek yang sama.",
  // team.ts — leaveProjectAction
  LEAVE_IS_OWNER: "Pemilik proyek tidak bisa keluar lewat sini — tutup proyek lewat tombol \"Tandai proyek selesai\".",
  LEAVE_NOT_MEMBER: "Kamu bukan anggota aktif proyek ini.",
  // workspace.ts
  NOT_MEMBER: "Kamu bukan anggota aktif proyek ini.",
  MILESTONE_INVALID: "Judul milestone minimal 3 karakter dan tenggat harus diisi dengan benar.",
  MILESTONE_NOT_FOUND: "Milestone ini tidak ditemukan — mungkin sudah dihapus.",
  TASK_INVALID: "Judul task minimal 3 karakter.",
  TASK_STATUS_INVALID: "Status task tidak bisa diubah lagi dari sini.",
  TASK_CONFIRM_INVALID: "Task ini bukan sedang menunggu konfirmasi.",
  TASK_CONFIRM_NOT_AUTHORIZED: "Hanya owner proyek atau pemilik milestone yang bisa mengonfirmasi task ini.",
  COMPLETE_MILESTONE_NOT_AUTHORIZED: "Hanya owner proyek atau pemilik milestone yang bisa menyelesaikan milestone ini.",
  // projects.ts
  WEIGHTS_NOT_OWNER: "Hanya pemilik proyek yang bisa mengubah bobot skor.",
  WEIGHTS_INVALID: "Nilai bobot tidak valid.",
  COMPLETE_NOT_ALLOWED: "Proyek ini sudah selesai atau kamu bukan pemiliknya.",
  DELETE_NOT_ALLOWED: "Proyek tidak dapat dihapus atau kamu bukan pemiliknya.",
  // discussion.ts / updates.ts
  COMMENT_INVALID: "Komentar minimal 3 karakter.",
  UPDATE_INVALID: "Progress update minimal 3 karakter.",
} as const;

export type ActionNoticeCode = keyof typeof ACTION_NOTICE_MESSAGES;

export function noticeMessage(code: string | undefined): string | null {
  if (!code) return null;
  return ACTION_NOTICE_MESSAGES[code as ActionNoticeCode] ?? "Aksi tidak bisa dilakukan.";
}

/** Menempelkan ?e=KODE ke path tujuan redirect, dipakai Server Action. */
export function noticeUrl(path: string, code: ActionNoticeCode): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}e=${code}`;
}
