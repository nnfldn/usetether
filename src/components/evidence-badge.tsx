// B5: jenjang bukti skill (Blueprint Bagian 08) sebelumnya tampil sebagai
// angka telanjang ("bukti level 0.5") — tidak berarti apa-apa bagi
// pengguna awam, padahal ini penopang inovasi anti-gaming. Chip berlabel +
// indikator bertingkat (N dari 4 titik terisi), bukan cuma angka.
const TIERS = [
  { level: 0.5, label: "Klaim mandiri" },
  { level: 0.65, label: "Ada portofolio" },
  { level: 0.8, label: "Diendorse rekan" },
  { level: 1.0, label: "Terbukti di proyek" },
] as const;

function tierIndex(level: number): number {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (level >= TIERS[i].level - 0.001) idx = i;
  }
  return idx;
}

export function EvidenceBadge({ level }: { level: number }) {
  const idx = tierIndex(level);
  const tier = TIERS[idx];

  return (
    <span className="md-chip inline-flex items-center gap-1.5" title={`Bukti level ${level.toFixed(2)}`}>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {TIERS.map((t, i) => (
          <span
            key={t.level}
            className={`h-1.5 w-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-outline"}`}
          />
        ))}
      </span>
      {tier.label}
    </span>
  );
}
