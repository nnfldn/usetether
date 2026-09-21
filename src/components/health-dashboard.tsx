import type { HealthAlert } from "@/lib/health/score";
import { HealthGauge, HealthTrend } from "@/components/health-gauge";
import { formatCalendarDate } from "@/lib/date";
import { HEALTH_STATUS_LABEL } from "@/lib/labels";

type Snapshot = {
  pulse: number;
  momentum: number;
  balance: number;
  forecast: number;
  composite: number;
  snapshotDate: Date;
} | null;

const STATUS_STYLE: Record<string, string> = {
  // Warna dari token kesehatan di globals.css — ubah di sana, gauge dan
  // badge ini ikut berubah bersamaan. Varian *-text (bukan warna dasar
  // health-*) dipakai karena di sini warnanya jadi TEKS di atas
  // container-nya sendiri — warna dasar cuma 2.7-3.6:1, gagal WCAG AA;
  // rombak UI/UX B1.1.
  SEHAT: "bg-health-good-container text-health-good-text",
  PERLU_PERHATIAN: "bg-health-warn-container text-health-warn-text",
  BERISIKO: "bg-health-risk-container text-health-risk-text",
  KRITIS: "bg-health-critical-container text-health-critical-text",
};

function statusFromComposite(composite: number) {
  if (composite >= 80) return "SEHAT";
  if (composite >= 60) return "PERLU_PERHATIAN";
  if (composite >= 40) return "BERISIKO";
  return "KRITIS";
}

const INDICATORS = [
  { key: "pulse" as const, label: "Pulse", hint: "Aktivitas 7 hari terakhir, meluruh dengan waktu" },
  { key: "momentum" as const, label: "Momentum", hint: "Percepatan dibanding minggu sebelumnya" },
  { key: "balance" as const, label: "Balance", hint: "Pemerataan kontribusi antar anggota" },
  { key: "forecast" as const, label: "Forecast", hint: "Kecepatan aktual vs kebutuhan tenggat" },
];

export function HealthDashboard({
  snapshot,
  alerts,
  compositeHistory = [],
  isCompleted = false,
}: {
  snapshot: Snapshot;
  alerts: HealthAlert[];
  /** Composite score N hari terakhir, terurut lama -> baru (untuk tren). */
  compositeHistory?: number[];
  /** Proyek sudah ditutup — indikator ditampilkan sebagai CATATAN SEJARAH,
   *  bukan vonis risiko. Skor kesehatan mengukur "apakah proyek ini akan
   *  selesai"; untuk proyek yang sudah selesai, pertanyaan itu sudah
   *  terjawab, dan label "BERISIKO" pada pekerjaan yang berhasil
   *  diselesaikan hanya menyesatkan. */
  isCompleted?: boolean;
}) {
  return (
    <section className="md-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-on-surface-variant">
          {isCompleted ? "Kesehatan proyek saat berjalan" : "Kesehatan proyek"}
        </h2>
        {snapshot &&
          (isCompleted ? (
            <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant">
              Selesai
            </span>
          ) : (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[statusFromComposite(snapshot.composite)]}`}
            >
              {HEALTH_STATUS_LABEL[statusFromComposite(snapshot.composite)]} ·{" "}
              {snapshot.composite.toFixed(0)}
            </span>
          ))}
      </div>

      {!snapshot ? (
        <p className="text-sm text-on-surface-muted">
          Belum ada snapshot kesehatan, dihitung otomatis oleh cron harian
          setelah ada aktivitas tercatat di proyek ini.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {INDICATORS.map((ind) => (
              <div key={ind.key} title={ind.hint}>
                <HealthGauge value={snapshot[ind.key]} label={ind.label} />
              </div>
            ))}
          </div>
          <div className="mt-4 border-t pt-4">
            <HealthTrend points={compositeHistory} />
          </div>
          <p className="mt-3 text-xs text-on-surface-muted">
            {/* formatCalendarDate, bukan toLocaleDateString polos — snapshotDate
                adalah tanggal kalender murni, lihat catatan di lib/date.ts */}
            Snapshot terakhir: {formatCalendarDate(new Date(snapshot.snapshotDate))}
          </p>
        </>
      )}

      {alerts.length > 0 && (
        <ul className="mt-4 space-y-2 border-t pt-4">
          {alerts.map((a) => (
            <li
              key={a.trigger}
              className="rounded border border-health-risk bg-health-risk-container p-2 text-sm text-health-risk-text"
            >
              {a.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
