import { z } from "zod";

// Keputusan #4 Lampiran C: pengguna boleh gabung banyak proyek sekaligus,
// tapi dengan "batas wajar (mis. tiga proyek aktif)". Dipakai di
// createProjectAction (owner otomatis jadi anggota) — batas keanggotaan
// TeamMember aktif secara keseluruhan, bukan cuma proyek yang dia buat.
export const MAX_ACTIVE_PROJECTS = 50;

export const createProjectSchema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(140),
  goal: z.string().trim().min(10, "Tujuan minimal 10 karakter").max(1000),
  tags: z.string().trim().max(300).optional().or(z.literal("")),
  deadline: z.string().optional().or(z.literal("")),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

// Keputusan #6 Lampiran C: owner boleh menyesuaikan bobot skor kecocokan.
// Validasi di sini cuma menjaga bentuk input (angka 0..1); penegakan cap
// anti-bias Experience 0.15 + normalisasi ada di sanitizeWeights()
// (src/lib/matching/score.ts) supaya berlaku di SEMUA jalur, bukan cuma
// lewat form ini.
export const updateMatchWeightsSchema = z.object({
  gapCoverage: z.coerce.number().min(0).max(1),
  availability: z.coerce.number().min(0).max(1),
  complementarity: z.coerce.number().min(0).max(1),
  interest: z.coerce.number().min(0).max(1),
  experience: z.coerce.number().min(0).max(1),
});

export const requirementRowSchema = z.object({
  skillName: z.string().trim().min(1).max(60),
  importance: z.coerce.number().min(0).max(1),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
