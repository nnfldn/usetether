import { z } from "zod";

export const postCommentSchema = z.object({
  body: z.string().trim().min(3, "Komentar minimal 3 karakter").max(500),
});
