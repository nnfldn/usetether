// SVG buatan sendiri (Blueprint eksplisit: bukan library chart, ROADMAP.md
// milestone 3.4). Poligon kebutuhan (putus-putus) ditumpuk dengan cakupan
// tim (area terisi), pada sumbu yang sama, disertai label teks + status per
// sumbu — jangan andalkan warna saja (poin aksesibilitas eksplisit Blueprint).

export type RadarAxis = {
  skillName: string;
  requirement: number; // r[j], 0..1
  coverage: number; // t[j], 0..1
};

const SIZE = 280;
// B3: label sumbu (mis. "Manajemen Proyek") dipusatkan (textAnchor="middle")
// tepat di titik tepi radius — untuk label panjang di sumbu kiri/kanan,
// setengah lebar teksnya melewati batas viewBox lama (0..SIZE) dan
// terpotong (SVG root overflow:hidden bawaan browser). viewBox digeser
// negatif + diperbesar di keempat sisi supaya ada ruang tanpa mengubah
// hitungan CENTER/RADIUS di bawah.
const PADDING = 16;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 56; // ruang untuk label di tepi

function pointAt(index: number, total: number, value: number): [number, number] {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const r = Math.max(0, Math.min(1, value)) * RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function statusOf(requirement: number, coverage: number): {
  label: string;
  className: string;
} {
  if (coverage >= requirement) return { label: "tercukupi", className: "text-health-good-text" };
  if (coverage > 0) return { label: "sebagian", className: "text-health-warn-text" };
  return { label: "kosong", className: "text-health-risk-text" };
}

export function TeamRadar({ axes }: { axes: RadarAxis[] }) {
  if (axes.length === 0) {
    return (
      <p className="text-sm text-on-surface-muted">
        Belum ada requirement skill, tambahkan lewat halaman edit proyek
        supaya radar bisa dihitung.
      </p>
    );
  }

  const n = axes.length;
  const requirementPoints = axes.map((a, i) => pointAt(i, n, a.requirement));
  const coveragePoints = axes.map((a, i) => pointAt(i, n, a.coverage));
  const toPath = (pts: [number, number][]) => pts.map((p) => p.join(",")).join(" ");
  const radarSummary = `Team Radar: ${axes.length} skill dibutuhkan, cakupan tim ${axes
    .map((a) => `${a.skillName} ${statusOf(a.requirement, a.coverage).label}`)
    .join(", ")}`;

  return (
    <div className="space-y-4">
      <svg
        viewBox={`${-PADDING} ${-PADDING} ${SIZE + PADDING * 2} ${SIZE + PADDING * 2}`}
        // max-w-md (448px), bukan max-w-xs (320px) — kolom desktop
        // lg:grid-cols-[1.2fr_1fr] di team/page.tsx punya ruang yang
        // sebelumnya terbuang oleh cap lebar terlalu kecil.
        className="mx-auto w-full max-w-md"
        role="img"
        aria-label={radarSummary}
      >
        {/* Sumbu referensi dari pusat ke tepi */}
        {axes.map((_, i) => {
          const [x, y] = pointAt(i, n, 1);
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="currentColor"
              className="text-outline"
              strokeWidth={1}
            />
          );
        })}

        {/* Poligon kebutuhan proyek — garis putus-putus */}
        <polygon
          points={toPath(requirementPoints)}
          fill="none"
          stroke="currentColor"
          className="text-on-surface-muted"
          strokeDasharray="4 3"
          strokeWidth={2}
        />

        {/* Poligon cakupan tim saat ini — area terisi solid */}
        <polygon
          points={toPath(coveragePoints)}
          fill="currentColor"
          className="text-on-surface/20"
          stroke="var(--color-on-surface)"
          strokeWidth={2}
        />

        {/* Label nama skill di tepi tiap sumbu */}
        {axes.map((a, i) => {
          const [x, y] = pointAt(i, n, 1.18);
          return (
            <text
              key={a.skillName}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-on-surface-variant text-[9px]"
            >
              {a.skillName}
            </text>
          );
        })}
      </svg>

      {/* Status tekstual per skill — tidak mengandalkan warna saja */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {axes.map((a) => {
          const status = statusOf(a.requirement, a.coverage);
          return (
            <li key={a.skillName} className="flex items-center justify-between">
              <span>{a.skillName}</span>
              <span className={`font-medium ${status.className}`}>{status.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
