import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/generated/prisma/client";

// Checklist keamanan Blueprint Bagian 09: "Audit log untuk perubahan
// keanggotaan dan kepemilikan proyek". Append-only — dipanggil dari
// Server Action yang benar-benar mengubah keanggotaan (respondInvitationAction,
// leaveProjectAction), tidak pernah di-update/delete setelah ditulis.
export async function logAudit(input: {
  projectId: string;
  actorId: string;
  targetProfileId: string;
  action: AuditAction;
}): Promise<void> {
  await prisma.auditLog.create({ data: input });
}
