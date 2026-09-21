import { createBrowserClient } from "@supabase/ssr";

// Dipakai di client component ('use client'). Aman memakai publishable key
// di sini — memang dirancang terlihat di browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
