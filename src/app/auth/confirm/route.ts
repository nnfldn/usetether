import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appPath } from "@/lib/app-path";

// Tujuan link email reset sandi (lihat requestPasswordResetAction). Route
// Handler — BUKAN Server Component — karena exchangeCodeForSession perlu
// menulis cookie sesi ke response secara andal; Server Component cuma
// bisa mencoba (lihat catatan try/catch di lib/supabase/server.ts).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/work";
  // Validasi: hanya izinkan redirect ke path relatif internal (cegah open redirect)
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/work";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${appPath(next)}`);
    }
  }

  return NextResponse.redirect(`${origin}${appPath("/sign-in")}?error=link-tidak-valid`);
}
