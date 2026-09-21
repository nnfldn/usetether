// Should-have Blueprint Bagian 11: "Visualisasi beban kerja — bar per
// anggota; sumber angka Balance".
//
// SENGAJA OWNER-ONLY (dipanggil dengan penjagaan isOwner di page.tsx).
// Etika pemantauan Bagian 07: "Menyorot satu orang di depan tim menghukum,
// bukan membantu" — peringatan Balance sudah owner-only, jadi rincian
// per-anggota yang jadi dasarnya pun mengikuti aturan yang sama. Ini
// distribusi untuk owner menata ulang beban, BUKAN papan skor anggota.
export function WorkloadBars({
  members,
}: {
  members: { profileId: string; fullName: string; contribution: number }[];
}) {
  if (members.length === 0) {
    return <p className="text-sm text-on-surface-muted">Belum ada aktivitas tercatat untuk dibagi.</p>;
  }

  const total = members.reduce((s, m) => s + m.contribution, 0);
  const max = Math.max(...members.map((m) => m.contribution), 1);

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const share = total > 0 ? (m.contribution / total) * 100 : 0;
        return (
          <div key={m.profileId} className="text-sm">
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>{m.fullName}</span>
              {/* Angka & persentase selalu tertulis, bukan cuma panjang bar */}
              <span>
                {m.contribution} poin · {share.toFixed(0)}%
              </span>
            </div>
            <div
              className="mt-1 h-2 rounded-full bg-surface-container-high"
              role="img"
              aria-label={`${m.fullName}: ${m.contribution} poin, ${share.toFixed(0)} persen dari total`}
            >
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${(m.contribution / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-xs text-on-surface-muted">
        Bobot aktivitas 14 hari terakhir, angka yang sama yang dipakai menghitung indikator Balance.
        Terlihat oleh owner saja.
      </p>
    </div>
  );
}
