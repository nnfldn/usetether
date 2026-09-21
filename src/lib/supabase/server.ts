import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Dipakai di server component, Server Action, dan Route Handler. Baca/tulis
// cookie sesi lewat Next.js `cookies()` — inilah yang membuat sesi Supabase
// Auth ikut terbaca di sisi server (middleware.ts memakai pola serupa untuk
// menjaga route terproteksi).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Dipanggil dari Server Component (bukan Server Action/Route
            // Handler) — boleh diabaikan selama middleware.ts sudah
            // menangani refresh sesi di setiap request.
          }
        },
      },
    },
  );
}
