import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; skill?: string; status?: string }>;
}) {
  const { q, skill, status } = await searchParams;

  const where: Prisma.ProjectWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { goal: { contains: q, mode: "insensitive" } },
    ];
  }
  if (skill) {
    where.requirements = { some: { skillId: skill } };
  }
  if (status !== "all") {
    where.status = { in: ["DRAFT", "ACTIVE"] };
  }

  const [projects, skills] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        team: { select: { members: { where: { status: "ACTIVE" }, select: { id: true } } } },
        requirements: {
          include: { skill: true },
          orderBy: { importance: "desc" },
          take: 4,
        },
      },
    }),
    prisma.skill.findMany({
      where: { category: { not: null } },
      orderBy: { name: "asc" },
    }),
  ]);

  const hasFilter = Boolean(q || skill || status === "all");

  return (
    <div className="page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline pb-5">
        <div>
          <p className="eyebrow">DISCOVERY</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-tight text-on-surface mt-1">
            Proyek
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
            Temukan ruang untuk kontribusimu dan mulai bekerja bersama tim adaptif.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/projects/history" className="font-mono text-xs font-semibold text-primary hover:underline">
            Riwayat Proyek
          </Link>
          <Link href="/projects/new" className="md-btn md-btn-filled">
            ＋ Buat Proyek
          </Link>
        </div>
      </div>

      <div className="md-card p-4 sm:p-5">
        <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label htmlFor="q" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Cari Judul / Tujuan
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q ?? ""}
              placeholder="mis. peta kampus, antrian..."
              className="md-field"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="skill" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Butuh Keahlian
            </label>
            <select id="skill" name="skill" defaultValue={skill ?? ""} className="md-field">
              <option value="">Semua keahlian</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="block font-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Status Proyek
            </label>
            <select id="status" name="status" defaultValue={status ?? ""} className="md-field">
              <option value="">Aktif &amp; Draf</option>
              <option value="all">Semua status</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="md-btn md-btn-filled flex-1 sm:flex-initial">
              Cari
            </button>
            {hasFilter && (
              <Link href="/projects" className="md-btn md-btn-outlined">
                Reset
              </Link>
            )}
          </div>
        </form>
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-on-surface-muted px-1">
        <span>
          <strong className="text-on-surface font-bold">{projects.length}</strong> proyek ditemukan
        </span>
        <span>Katalog Terbuka</span>
      </div>

      {projects.length === 0 ? (
        <div className="md-card p-12 text-center space-y-4">
          <p className="text-on-surface-muted font-mono text-sm">
            {hasFilter
              ? "Tidak ada proyek yang cocok dengan kriteria filter."
              : "Belum ada proyek publik yang terdaftar. Jadilah yang pertama membuat proyek!"}
          </p>
          <Link href="/projects/new" className="md-btn md-btn-filled inline-flex">
            Buat Proyek Baru
          </Link>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="project-item group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 font-display text-base font-bold text-primary bg-primary-container/20">
                    {project.title.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-outline bg-surface-container text-primary">
                    {PROJECT_STATUS_LABEL[project.status] ?? project.status}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-on-surface group-hover:text-primary transition-colors">
                  {project.title}
                </h2>
                <p className="mt-1.5 text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                  {project.goal}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {project.requirements.map((r) => (
                    <span key={r.id} className="md-chip">
                      {r.skill.name}
                    </span>
                  ))}
                </div>
              </div>

              <footer className="mt-5 pt-3 border-t border-outline flex items-center justify-between font-mono text-[11px] text-on-surface-muted">
                <span>{project.team?.members.length ?? 0} Anggota</span>
                <span>
                  Tenggat{" "}
                  {project.deadline
                    ? new Date(project.deadline).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </span>
              </footer>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
