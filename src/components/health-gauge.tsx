// Blueprint Bagian 11, definisi selesai must-have #11: "Dihitung harian;
// ditampilkan sebagai gauge + tren" — sebelumnya cuma angka polos. SVG
// buatan sendiri (pola sama dengan team-radar.tsx), bukan library chart.
//
// Aksesibilitas (prinsip yang sama dengan Team Radar di Blueprint Bagian
// 06): angka & label teks SELALU tampil bareng warna, tidak pernah cuma
// mengandalkan warna cincinnya untuk menyampaikan status.
const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Warna diambil dari token di globals.css lewat var(), BUKAN hex di sini —
// supaya mengganti palet kesehatan cukup di satu tempat dan gauge, badge
// status, serta kotak peringatan ikut berubah bersamaan.
function colorFor(value: number): string {
  if (value >= 80) return "var(--color-health-good)";
  if (value >= 60) return "var(--color-health-warn)";
  if (value >= 40) return "var(--color-health-risk)";
  return "var(--color-health-critical)";
}

export function HealthGauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const color = colorFor(clamped);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 80 80" className="h-20 w-20" role="img" aria-label={`${label}: ${clamped.toFixed(0)} dari 100`}>
        <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="var(--color-outline)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="44" textAnchor="middle" fontSize="20" fontWeight="600" fill="var(--color-on-surface)">
          {clamped.toFixed(0)}
        </text>
      </svg>
      <span className="text-xs font-medium text-on-surface-variant">{label}</span>
    </div>
  );
}

// Tren composite score N hari terakhir — polyline sederhana, bukan
// library chart. `points` terurut dari paling lama ke paling baru.
export function HealthTrend({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <p className="text-xs text-on-surface-muted">Belum cukup riwayat untuk tren (butuh &ge;2 hari snapshot).</p>;
  }
  const width = 240;
  const height = 40;
  const stepX = width / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${(height - (Math.max(0, Math.min(100, p)) / 100) * height).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const trendWord = last > first + 2 ? "naik" : last < first - 2 ? "turun" : "stabil";

  return (
    <div>
      {/* B3: sebelumnya w-60 (240px tetap) di dalam kartu ~1000px —
          satu-satunya visual "tren" di app terpaku kecil di kiri.
          preserveAspectRatio="none" + w-full supaya svg melebar mengikuti
          lebar container sungguhan, viewBox tetap 240x40 untuk hitungan
          path di atas. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-10 w-full"
        role="img"
        aria-label={`Tren composite ${points.length} hari terakhir: ${trendWord}, dari ${first.toFixed(0)} ke ${last.toFixed(0)}`}
      >
        <path d={path} fill="none" stroke={colorFor(last)} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-1 text-xs text-on-surface-muted">
        Tren {points.length} hari terakhir: {trendWord} ({first.toFixed(0)} &rarr; {last.toFixed(0)})
      </p>
    </div>
  );
}
