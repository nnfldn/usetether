// dayOfWeek: 0 = Minggu ... 6 = Sabtu, konsisten dengan konvensi Postgres
// (lihat catatan di prisma/schema.prisma model Availability).
export const DAYS = [
  { value: 0, label: "Minggu" },
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
] as const;

export const DAY_LABELS: Record<number, string> = Object.fromEntries(
  DAYS.map((d) => [d.value, d.label]),
);

export const BLOCKS = ["PAGI", "SIANG", "SORE", "MALAM"] as const;
