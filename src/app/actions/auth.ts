"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  signUpSchema,
  signInSchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
} from "@/lib/validations/auth";
import { checkRateLimit, getClientIp, limitFromEnv } from "@/lib/rate-limit";

// Origin diambil dari header request (bukan env var) supaya link reset
// sandi otomatis benar baik di localhost dev maupun domain production
// begitu di-deploy, tanpa perlu env var URL situs terpisah untuk dijaga
// sinkron manual.
async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host");
  return `${proto}://${host}`;
}

export type AuthActionState = { error: string | null; success?: boolean };

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  // Checklist keamanan Blueprint Bagian 09: rate limit registrasi — cegah
  // pembuatan akun massal dari satu sumber. Default 3 per 10 menit per IP;
  // RATE_LIMIT_SIGN_UP menimpanya (Vercel Preview/latihan demo, dev lokal).
  const ip = await getClientIp();
  if (!checkRateLimit(`sign-up:${ip}`, limitFromEnv("RATE_LIMIT_SIGN_UP", 3), 10 * 60 * 1000)) {
    return { error: "Terlalu banyak percobaan daftar. Coba lagi beberapa menit lagi." };
  }

  const supabase = await createClient();

  // Mode Instan / Demo: Lewati verifikasi email jika SUPABASE_SECRET_KEY ada.
  // Akun dibuat langsung terkonfirmasi (email_confirm: true) lewat Admin API,
  // lalu langsung login otomatis agar cookie sesi terpasang di browser.
  if (process.env.SUPABASE_SECRET_KEY) {
    try {
      const admin = createAdminClient();
      const { error: adminError } = await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: { full_name: parsed.data.fullName },
      });

      if (adminError) {
        return { error: adminError.message };
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (signInError) {
        return { error: signInError.message };
      }

      redirect("/work");
    } catch (err: unknown) {
      // Jika redirect Next.js melempar NEXT_REDIRECT, teruskan
      if (err && typeof err === "object" && "digest" in err) {
        throw err;
      }
      return { error: err instanceof Error ? err.message : "Gagal membuat akun." };
    }
  }

  // Fallback pendaftaran standar
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) return { error: error.message };
  redirect("/work");
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  // Checklist keamanan Blueprint Bagian 09: rate limit login — cegah brute
  // force password. Dikunci per IP+email (bukan IP saja) supaya satu
  // penyerang tidak bisa menghabiskan jatah percobaan korban dari IP lain,
  // dan satu IP kantor/kos ramai tidak saling mengunci penghuninya. Default
  // 5 percobaan per 5 menit; RATE_LIMIT_SIGN_IN menimpanya — item #6
  // RENCANA-EKSEKUSI-20-SEP.md: latihan demo berulang & E2E ganti-ganti
  // akun akan menabrak ambang produksi kalau tidak bisa dilonggarkan.
  const ip = await getClientIp();
  if (
    !checkRateLimit(
      `sign-in:${ip}:${parsed.data.email}`,
      limitFromEnv("RATE_LIMIT_SIGN_IN", 5),
      5 * 60 * 1000,
    )
  ) {
    return { error: "Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi." };
  }

  const supabase = await createClient();
  let { error } = await supabase.auth.signInWithPassword(parsed.data);

  // Jika akun lama belum terverifikasi dan admin key tersedia, konfirmasi otomatis
  if (
    error &&
    error.message.toLowerCase().includes("email not confirmed") &&
    process.env.SUPABASE_SECRET_KEY
  ) {
    try {
      const admin = createAdminClient();
      const { data: usersData } = await admin.auth.admin.listUsers();
      const matched = usersData?.users.find(
        (u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase(),
      );
      if (matched) {
        await admin.auth.admin.updateUserById(matched.id, { email_confirm: true });
        const retryResult = await supabase.auth.signInWithPassword(parsed.data);
        error = retryResult.error;
      }
    } catch {
      // Abaikan fallback error
    }
  }

  if (error) return { error: "Email atau kata sandi salah." };
  redirect("/work");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

// Must-have #1 Blueprint Bagian 11: "Daftar, masuk, keluar, lupa sandi,
// hash aman, rate limit" — sebelumnya cuma 4 dari 5 ada. Selalu balas
// pesan sukses yang SAMA baik email terdaftar maupun tidak (mencegah
// enumerasi akun lewat pesan error yang beda-beda).
export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState & { success?: boolean }> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const ip = await getClientIp();
  if (
    !checkRateLimit(
      `reset-password:${ip}:${parsed.data.email}`,
      limitFromEnv("RATE_LIMIT_RESET_PASSWORD", 3),
      15 * 60 * 1000,
    )
  ) {
    // Tetap balas sukses (bukan error) — jangan bocorkan lewat pesan
    // rate-limit bahwa email ini valid/aktif dicoba berulang.
    return { error: null, success: true };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  return { error: null, success: true };
}

export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Halaman /reset-password cuma bisa dicapai lewat link email yang sudah
  // menukar kode jadi sesi (lihat auth/confirm/route.ts) — kalau tidak ada
  // sesi, link-nya kedaluwarsa/tidak valid.
  if (!user) return { error: "Sesi reset sandi tidak valid atau sudah kedaluwarsa. Minta link baru." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  redirect("/profile");
}

export async function changePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Kata sandi tidak valid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { error: null, success: true };
}
