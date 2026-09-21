import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewProjectForm } from "@/components/forms/new-project-form";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="page-narrow space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-outline pb-4">
        <div>
          <p className="eyebrow">INISIASI PROYEK</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-tight text-on-surface mt-1">
            Buat Proyek Baru
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Bentuk tim kolaborasi baru dan tentukan profil keahlian yang dibutuhkan.
          </p>
        </div>
        <Link href="/projects" className="text-xs font-mono font-semibold text-primary hover:underline whitespace-nowrap">
          ← Kembali ke Proyek
        </Link>
      </div>

      <div className="md-card p-6 sm:p-8">
        <NewProjectForm />
      </div>
    </div>
  );
}
