import { createClient } from "@supabase/supabase-js";

// Client admin (service role) — HANYA boleh diimpor dari 'use server'
// Server Action atau Route Handler (konteks server Next.js), TIDAK PERNAH
// dari client component — SUPABASE_SECRET_KEY tidak diawali NEXT_PUBLIC_
// jadi Next.js sudah menolak membundelnya ke kode browser, tapi tetap
// jangan pernah impor file ini dari file yang punya "use client".
// Dipakai untuk operasi yang butuh hak admin Supabase Auth (mis. hapus
// akun) yang tidak bisa dilakukan lewat client biasa (anon key).
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SECRET_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
