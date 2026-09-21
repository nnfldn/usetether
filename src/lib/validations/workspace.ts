import { z } from "zod";

export const createMilestoneSchema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(140),
  deadline: z.string().min(1, "Tenggat wajib diisi"),
  weight: z.coerce.number().int().min(1).max(20).default(1),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(140),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  weight: z.coerce.number().int().min(1).max(20).default(1),
  assigneeId: z.string().optional().or(z.literal("")),
});

export const postProgressUpdateSchema = z.object({
  body: z.string().trim().min(3, "Update minimal 3 karakter").max(500),
});
