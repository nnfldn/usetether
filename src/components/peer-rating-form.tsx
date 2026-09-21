"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { submitPeerRatingAction, type PeerRatingState } from "@/app/actions/peer-rating";
import { PEER_RATING_MIN, PEER_RATING_MAX } from "@/lib/matching/experience";

const DIMENSI = [
  { name: "timeliness", label: "Ketepatan waktu", hint: "Menyelesaikan bagiannya sesuai waktu yang disepakati" },
  { name: "quality", label: "Kualitas kontribusi", hint: "Hasil kerjanya bisa langsung dipakai tim" },
  { name: "communication", label: "Komunikasi", hint: "Mengabari lebih awal saat ada hambatan" },
] as const;

const SKALA = Array.from(
  { length: PEER_RATING_MAX - PEER_RATING_MIN + 1 },
  (_, i) => PEER_RATING_MIN + i,
);

export function PeerRatingForm({
  projectId,
  ratedId,
  ratedName,
  existing,
}: {
  projectId: string;
  ratedId: string;
  ratedName: string;
  existing?: { timeliness: number; quality: number; communication: number } | null;
}) {
  const [state, formAction] = useActionState<PeerRatingState, FormData>(
    submitPeerRatingAction,
    { error: null },
  );

  return (
    <form action={formAction} className="border-t pt-4 first:border-t-0 first:pt-0">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="ratedId" value={ratedId} />

      <p className="md-label mb-3">{ratedName}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        {DIMENSI.map((d) => (
          <div key={d.name}>
            {/* htmlFor menyertakan ratedId: satu halaman merender form ini
                berkali-kali (satu per rekan), jadi id yang sama akan membuat
                klik label memilih radio milik orang lain. */}
            <label
              htmlFor={`${d.name}-${ratedId}`}
              className="block text-sm font-medium text-on-surface"
            >
              {d.label}
            </label>
            <p className="mb-2 text-xs text-on-surface-variant">{d.hint}</p>
            <select
              id={`${d.name}-${ratedId}`}
              name={d.name}
              defaultValue={existing?.[d.name] ?? 3}
              className="md-field w-full"
            >
              {SKALA.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <SubmitButton className="md-btn md-btn-outlined md-btn-sm" pendingLabel="Menyimpan…">
          {existing ? "Perbarui penilaian" : "Simpan penilaian"}
        </SubmitButton>
        {state.error && <span className="text-sm text-error">{state.error}</span>}
        {state.ok && <span className="text-sm text-on-surface-variant">Tersimpan.</span>}
      </div>
    </form>
  );
}
