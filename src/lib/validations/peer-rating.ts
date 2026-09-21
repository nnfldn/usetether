import { z } from "zod";
import { PEER_RATING_MIN, PEER_RATING_MAX } from "@/lib/matching/experience";

// Rentang diambil dari konstanta yang sama dengan yang dipakai menghitung
// peer_rating_norm — kalau skalanya nanti berubah, validasi ikut berubah
// sendiri dan tidak bisa melenceng dari rumusnya.
const dimensi = z.coerce
  .number()
  .int({ message: "Nilai harus bilangan bulat" })
  .min(PEER_RATING_MIN, { message: `Nilai minimal ${PEER_RATING_MIN}` })
  .max(PEER_RATING_MAX, { message: `Nilai maksimal ${PEER_RATING_MAX}` });

export const peerRatingSchema = z.object({
  projectId: z.string().uuid(),
  ratedId: z.string().uuid(),
  timeliness: dimensi,
  quality: dimensi,
  communication: dimensi,
});

export type PeerRatingInputParsed = z.infer<typeof peerRatingSchema>;
