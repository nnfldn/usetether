import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DAYS, BLOCKS, DAY_LABELS } from "@/lib/availability";
import { MIN_SKILLS_FOR_RECOMMENDATION } from "@/lib/validations/profile";
import { EvidenceBadge } from "@/components/evidence-badge";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const BLOCK_LABEL: Record<string, string> = {
  PAGI: "Pagi",
  SIANG: "Siang",
  SORE: "Sore",
  MALAM: "Malam",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    include: { skills: { include: { skill: true } }, availability: true },
  });

  return (
    <div className="page-narrow space-y-6">
      {/* Profile Header with Photo Placeholder */}
      <div className="md-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="relative shrink-0">
          <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-2 border-outline bg-surface-container text-primary font-display text-3xl sm:text-4xl font-bold shadow-inner uppercase overflow-hidden">
            {profile?.fullName ? getInitials(profile.fullName) : "FS"}
          </div>
          <span
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary text-xs font-bold border-2 border-surface shadow-sm cursor-pointer"
            title="Foto Profil Placeholder"
          >
            📷
          </span>
        </div>

        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="eyebrow">PROFIL MAHASISWA</span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-primary/40 bg-primary-container/20 text-primary font-bold">
              AKTIF
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display uppercase tracking-tight text-on-surface truncate">
            {profile?.fullName ?? user.email}
          </h1>
          <p className="font-mono text-xs text-on-surface-variant">
            {user.email} {profile?.faculty ? `· ${profile.faculty}` : ""}
          </p>
        </div>

        <Link href="/profile/edit" className="md-btn md-btn-filled sm:self-center shrink-0">
          Edit Profil
        </Link>
      </div>

      {profile?.bio && (
        <div className="md-card p-5">
          <p className="font-mono text-xs uppercase text-on-surface-muted mb-1">Bio Singkat</p>
          <p className="text-sm text-on-surface-body leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Skills & Evidence */}
      <section className="md-card md-card-accent p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-outline pb-3">
          <div>
            <p className="eyebrow">PORTFOLIO KEAHLIAN</p>
            <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
              Skill &amp; Level Bukti
            </h2>
          </div>
          {(profile?.skills.length ?? 0) < MIN_SKILLS_FOR_RECOMMENDATION && (
            <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-health-warn bg-health-warn-container text-health-warn-text">
              Kurang {MIN_SKILLS_FOR_RECOMMENDATION - (profile?.skills.length ?? 0)} skill lagi
            </span>
          )}
        </div>

        {profile?.skills.length ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.skills.map((s) => (
              <li
                key={s.id}
                className="p-3 rounded-[var(--radius-xs)] border border-outline bg-surface-container/50 flex items-center justify-between gap-2"
              >
                <span className="font-bold text-sm text-on-surface">{s.skill.name}</span>
                <EvidenceBadge level={s.evidenceLevel} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-xs text-on-surface-muted text-center py-4">
            Belum ada keahlian yang ditambahkan ke profilmu.
          </p>
        )}
      </section>

      {/* Interests */}
      <section className="md-card p-6 space-y-4">
        <div className="border-b border-outline pb-3">
          <p className="eyebrow">MINAT &amp; TOPIK</p>
          <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
            Minat Kolaborasi
          </h2>
        </div>

        {profile?.interests.length ? (
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <span key={interest} className="md-chip">
                #{interest}
              </span>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-on-surface-muted text-center py-4">
            Belum ada tag minat yang ditambahkan.
          </p>
        )}
      </section>

      {/* Availability */}
      <section className="md-card p-6 space-y-4">
        <div className="border-b border-outline pb-3">
          <p className="eyebrow">JADWAL MINGGUAN</p>
          <h2 className="text-xl font-bold font-display uppercase tracking-tight text-on-surface">
            Ketersediaan Waktu
          </h2>
        </div>

        {profile?.availability.length ? (
          (() => {
            const filled = new Set(profile.availability.map((a) => `${a.dayOfWeek}-${a.block}`));
            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-outline">
                      <th className="p-2.5 text-left text-on-surface-variant uppercase font-semibold">Hari</th>
                      {BLOCKS.map((b) => (
                        <th key={b} className="p-2.5 text-center text-on-surface-variant uppercase font-semibold">
                          {BLOCK_LABEL[b]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day.value} className="border-b border-outline/50 last:border-0 hover:bg-surface-container/30">
                        <td className="p-2.5 font-bold uppercase text-on-surface">{day.label}</td>
                        {BLOCKS.map((block) => (
                          <td key={block} className="p-2.5 text-center">
                            <span
                              className={`inline-block h-4 w-4 rounded-full border ${
                                filled.has(`${day.value}-${block}`)
                                  ? "bg-primary border-primary"
                                  : "bg-surface-container-high border-outline/40"
                              }`}
                              aria-hidden="true"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="sr-only">
                  Tersedia: {profile.availability
                    .map((a) => `${DAY_LABELS[a.dayOfWeek]} ${BLOCK_LABEL[a.block] ?? a.block}`)
                    .join(", ")}
                </p>
              </div>
            );
          })()
        ) : (
          <p className="font-mono text-xs text-on-surface-muted text-center py-4">
            Belum mengisi blok ketersediaan jadwal mingguan.
          </p>
        )}
      </section>

      {/* Security Quick Link */}
      <div className="p-4 rounded-[var(--radius-xs)] border border-outline bg-surface-container/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
        <div>
          <p className="font-bold text-on-surface">Kredensial &amp; Keamanan Akun</p>
          <p className="text-on-surface-muted text-[11px]">
            Ganti kata sandi, unduh data pribadi JSON, atau kelola sesi aktif.
          </p>
        </div>
        <Link href="/security" className="md-btn md-btn-outlined md-btn-sm whitespace-nowrap self-start sm:self-auto">
          Buka Pengaturan Keamanan →
        </Link>
      </div>
    </div>
  );
}
