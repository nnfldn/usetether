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
import { appPath } from "@/lib/app-path";
import { after } from "next/server";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  isDemoEmail,
  seedDemoData,
} from "@/lib/demo";

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

// redirectTo dipakai ONLY oleh action yang form-nya duduk di halaman statis
// (/sign-in, /sign-up, /reset-password). Dari sana Server Action dijawab 303
// dengan Location apa adanya, jadi basePath tidak ikut ditambahkan — sedangkan
// action yang dijalankan dari halaman dinamis dijawab payload RSC dan router di
// browser menambah basePath sendiri. Supaya tidak perlu menebak konteksnya,
// action statis mengembalikan path tujuan lalu router.push() dari client
// (router yang tahu soal basePath). Action di halaman dinamis tetap memakai
// redirect() biasa.
export type AuthActionState = {
  error: string | null;
  success?: boolean;
  redirectTo?: string;
};

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
  if (
    !checkRateLimit(
      `sign-up:${ip}`,
      limitFromEnv("RATE_LIMIT_SIGN_UP", 3),
      10 * 60 * 1000,
    )
  ) {
    return {
      error: "Terlalu banyak percobaan daftar. Coba lagi beberapa menit lagi.",
    };
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

      return { error: null, redirectTo: "/work" };
    } catch (err: unknown) {
      return {
        error: err instanceof Error ? err.message : "Gagal membuat akun.",
      };
    }
  }

  // Fallback pendaftaran standar
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) return { error: error.message };
  return { error: null, redirectTo: "/work" };
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
    return {
      error: "Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.",
    };
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
        await admin.auth.admin.updateUserById(matched.id, {
          email_confirm: true,
        });
        const retryResult = await supabase.auth.signInWithPassword(parsed.data);
        error = retryResult.error;
      }
    } catch {
      // Abaikan fallback error
    }
  }

  if (error) return { error: "Email atau kata sandi salah." };
  return { error: null, redirectTo: "/work" };
}

export async function signOutAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isDemo = isDemoEmail(user?.email);
  await supabase.auth.signOut();
  // Reset-on-signout: kembalikan data demo ke kondisi awal. Dijadwalkan lewat
  // after() supaya pengunjung tidak menunggu puluhan query database — dulu
  // resetnya memblokir tombol Keluar sampai 10+ detik di produksi. Reset-on-login
  // tetap jadi jaring pengaman kalau browser ditutup tanpa sign out.
  if (isDemo) {
    after(async () => {
      try {
        await seedDemoData();
      } catch {
        // Abaikan — reset-on-login berikutnya akan membersihkan.
      }
    });
  }
  redirect("/sign-in");
}

export async function demoSignInAction(): Promise<AuthActionState> {
  const supabase = await createClient();
  const credentials = { email: DEMO_EMAIL, password: DEMO_PASSWORD };
  // Reset dan login dijahit paralel: keduanya sama-sama butuh beberapa detik
  // ke database dan Supabase, dan tidak saling bergantung selama akunnya sudah
  // ada. Reset yang gagal tidak menghalangi masuk — data lamanya akan dibersihkan
  // pada reset berikutnya.
  let [signIn] = await Promise.all([
    supabase.auth.signInWithPassword(credentials),
    seedDemoData()
      .then(() => undefined)
      .catch(() => undefined),
  ]);
  if (signIn.error) {
    // Akunnya mungkin baru dibuat oleh reset di atas (login tried before the
    // account existed) — coba masuk sekali lagi.
    signIn = await supabase.auth.signInWithPassword(credentials);
  }
  if (signIn.error)
    return { error: "Demo sedang tidak tersedia. Coba beberapa saat lagi." };
  return { error: null, redirectTo: "/projects" };
}

// Must-have #1 Blueprint Bagian 11: "Daftar, masuk, keluar, lupa sandi,
// hash aman, rate limit" — sebelumnya cuma 4 dari 5 ada. Selalu balas
// pesan sukses yang SAMA baik email terdaftar maupun tidak (mencegah
// enumerasi akun lewat pesan error yang beda-beda).
export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState & { success?: boolean }> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: formData.get("email"),
  });
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
    // next sengaja TANPA basePath: route auth/confirm yang menambahkan
    // basePath saat meloncat ke halaman tujuan (lihat lib/app-path.ts).
    redirectTo: `${origin}${appPath("/auth/confirm")}?next=/reset-password`,
  });

  return { error: null, success: true };
}

export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
  });
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
  if (!user)
    return {
      error:
        "Sesi reset sandi tidak valid atau sudah kedaluwarsa. Minta link baru.",
    };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  return { error: null, redirectTo: "/profile" };
}

export async function changePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Kata sandi tidak valid",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  return { error: null, success: true };
}
