import { z } from "zod";

// Divalidasi server-side (dipakai di Server Action) — checklist keamanan
// "validasi skema di sisi server" berlaku sejak form pertama.
export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter"),
  email: z.email("Email tidak valid"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
});

export const signInSchema = z.object({
  email: z.email("Email tidak valid"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export const requestPasswordResetSchema = z.object({
  email: z.email("Email tidak valid"),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
