// Peta enum database -> label Indonesia yang terlihat pengguna. Satu
// tempat, bukan ternary tersebar di tiap JSX (audit UI X1: enum mentah
// seperti "DRAFT"/"OWNER_INVITED" tampil apa adanya di beberapa halaman).
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  ACTIVE: "Aktif",
  DORMANT: "Dorman",
  COMPLETED: "Selesai",
};

// TeamMember.role bukan enum di skema (String bebas), tapi nilainya cuma
// dua yang pernah ditulis kode: "Owner" (projects.ts) dan "Member" (team.ts).
export const TEAM_ROLE_LABEL: Record<string, string> = {
  Owner: "Pemilik",
  Member: "Anggota",
};

export const MILESTONE_STATUS_LABEL: Record<string, string> = {
  TODO: "Belum mulai",
  IN_PROGRESS: "Dikerjakan",
  DONE: "Selesai",
  LATE: "Terlambat",
};

export const TASK_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
};

export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  INVITATION: "Undangan",
  HEALTH_ALERT: "Peringatan kesehatan",
  MILESTONE_DEADLINE: "Tenggat milestone",
};

// Bukan enum Prisma — dihitung di health-dashboard.tsx (statusFromComposite),
// tapi tetap diberi label di sini supaya konsisten satu tempat.
export const HEALTH_STATUS_LABEL: Record<string, string> = {
  SEHAT: "Sehat",
  PERLU_PERHATIAN: "Perlu perhatian",
  BERISIKO: "Berisiko",
  KRITIS: "Kritis",
};
