import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { EditProfileForm } from "@/components/forms/edit-profile-form";
import { AddSkillForm } from "@/components/forms/add-skill-form";
import { removeSkillAction, setAvailabilityAction } from "@/app/actions/profile";
import { DAYS, BLOCKS } from "@/lib/availability";
import { EvidenceBadge } from "@/components/evidence-badge";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    include: { skills: { include: { skill: true } }, availability: true },
  });
  if (!profile) redirect("/profile");

  const checkedSlots = new Set(
    profile.availability.map((a) => `${a.dayOfWeek}-${a.block}`),
  );

  return (
    <div className="page-narrow space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-outline pb-4">
        <div>
          <p className="eyebrow">PENGATURAN PROFIL</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-tight text-on-surface mt-1">
            Edit Profil
          </h1>
        </div>
        <Link href="/profile" className="font-mono text-xs font-semibold text-primary hover:underline whitespace-nowrap">
          ← Kembali ke Profil
        </Link>
      </div>

      <section className="md-card p-6 space-y-4">
        <div className="border-b border-outline pb-3">
          <p className="eyebrow">INFORMASI UMUM</p>
          <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
            Identitas Diri
          </h2>
        </div>

        {/* Photo Placeholder Card */}
        <div className="flex items-center gap-4 p-4 rounded-[var(--radius-xs)] border border-outline/50 bg-surface-container/30">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-outline bg-surface-container text-primary font-display text-2xl font-bold uppercase shadow-inner">
              {profile.fullName ? getInitials(profile.fullName) : "FS"}
            </div>
            <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary text-[10px]">
              📷
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="font-display font-bold text-sm uppercase text-on-surface">Foto Profil Placeholder</p>
            <p className="font-mono text-[11px] text-on-surface-muted leading-relaxed">
              Avatar saat ini menggunakan inisial namamu. Fitur unggah foto avatar kustom akan tersedia di rilis berikutnya.
            </p>
          </div>
        </div>

        <EditProfileForm
          fullName={profile.fullName}
          faculty={profile.faculty}
          bio={profile.bio}
          interests={profile.interests}
        />
      </section>

      <section className="md-card p-6 space-y-4">
        <div className="border-b border-outline pb-3">
          <p className="eyebrow">KEAHLIAN &amp; PORTOFOLIO</p>
          <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
            Daftar Skill
          </h2>
        </div>

        {profile.skills.length > 0 && (
          <ul className="space-y-2.5">
            {profile.skills.map((s) => (
              <li
                key={s.id}
                className="p-3 rounded-[var(--radius-xs)] border border-outline bg-surface-container/50 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-on-surface">{s.skill.name}</span>
                  <EvidenceBadge level={s.evidenceLevel} />
                  {s.portfolioUrl && (
                    <a
                      href={s.portfolioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-primary underline"
                    >
                      [portofolio ↗]
                    </a>
                  )}
                </div>
                <form action={removeSkillAction}>
                  <input type="hidden" name="profileSkillId" value={s.id} />
                  <button
                    type="submit"
                    className="font-mono text-xs text-error hover:underline"
                  >
                    Hapus
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-2 border-t border-outline">
          <AddSkillForm />
          <p className="mt-2 font-mono text-[11px] text-on-surface-muted">
            Level bukti otomatis: 0.50 klaim mandiri, 0.65 jika mencantumkan link portofolio publik.
          </p>
        </div>
      </section>

      <section className="md-card p-6 space-y-4">
        <div className="border-b border-outline pb-3">
          <p className="eyebrow">ALOKASI WAKTU</p>
          <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
            Ketersediaan Jadwal Mingguan
          </h2>
          <p className="mt-0.5 font-mono text-xs text-on-surface-muted">
            Pilih blok waktu luangmu agar algoritma matching dapat menghitung irisan ketersediaan tim.
          </p>
        </div>

        <form action={setAvailabilityAction} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-outline">
                  <th className="p-2.5 text-left text-on-surface-variant uppercase font-semibold">Hari</th>
                  {BLOCKS.map((b) => (
                    <th key={b} className="p-2.5 text-center text-on-surface-variant uppercase font-semibold">
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day.value} className="border-b border-outline/50 hover:bg-surface-container/30">
                    <td className="p-2.5 font-bold uppercase text-on-surface">{day.label}</td>
                    {BLOCKS.map((block) => {
                      const key = `${day.value}-${block}`;
                      return (
                        <td key={key} className="p-1 text-center">
                          <label className="flex h-9 w-full min-w-9 cursor-pointer items-center justify-center">
                            <span className="sr-only">
                              {day.label}, {block}
                            </span>
                            <input
                              type="checkbox"
                              name="slot"
                              value={key}
                              defaultChecked={checkedSlots.has(key)}
                              className="h-4 w-4 accent-primary rounded cursor-pointer"
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="md-btn md-btn-filled">
            Simpan Jadwal Ketersediaan
          </button>
        </form>
      </section>
    </div>
  );
}
