import { z } from "zod";

// Blueprint Bagian 11, definisi selesai must-have #2: "Skill berbobot
// bukti; minimal 3 skill wajib diisi". Diterapkan sebagai nudge UI (badge
// "profil belum lengkap"), BUKAN hard-block yang mencegah profil dengan
// <3 skill dipakai/muncul di rekomendasi — funnel Bagian 13 memperlakukan
// "profil lengkap" sebagai metrik yang didorong, bukan gerbang keras yang
// menyembunyikan pengguna baru dari matching sepenuhnya.
export const MIN_SKILLS_FOR_RECOMMENDATION = 3;

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter"),
  faculty: z.string().trim().max(120).optional().or(z.literal("")),
  bio: z.string().trim().max(500, "Bio maksimal 500 karakter").optional().or(z.literal("")),
  interests: z.string().trim().max(300).optional().or(z.literal("")),
});

export const addSkillSchema = z.object({
  skillName: z.string().trim().min(2, "Nama skill minimal 2 karakter").max(60),
  portfolioUrl: z.url("URL tidak valid").optional().or(z.literal("")),
});

const DAY_MIN = 0; // Minggu
const DAY_MAX = 6; // Sabtu
const BLOCKS = ["PAGI", "SIANG", "SORE", "MALAM"] as const;

export const availabilitySlotSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(DAY_MIN).max(DAY_MAX),
  block: z.enum(BLOCKS),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AddSkillInput = z.infer<typeof addSkillSchema>;
