import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Root ini bukan landing page pemasaran — itu situs statis terpisah di
// ~/Desktop/Project-Code/landing-page-tether/. Di sini cukup jadi
// pengalih: sudah masuk -> /projects, belum -> /sign-in.
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/projects" : "/sign-in");
}
