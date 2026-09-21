// Penanganan tanggal untuk kolom @db.Date (HealthSnapshot.snapshotDate).
//
// MASALAH YANG DIPERBAIKI (3 September 2026): sebelumnya tanggal snapshot
// dihitung dengan `new Date(now.toISOString().slice(0,10))` — itu tanggal
// UTC. Antara 00:00–07:00 WIB, tanggal UTC masih HARI KEMARIN, sehingga
// cron yang jalan jam 01:55 WIB menulis snapshot bertanggal kemarin.
// Akibatnya label "Snapshot terakhir" tampak tertinggal sehari DAN
// perbandingan "snapshot 7 hari lalu" (aturan PULSE_DROP) bisa mengambil
// baris yang salah.
//
// KONVENSI YANG DIPAKAI SEKARANG: kolom Date diperlakukan sebagai tanggal
// kalender murni tanpa makna zona waktu. Nilainya disimpan sebagai tengah
// malam UTC yang komponen Y-M-D-nya SAMA dengan tanggal kalender WIB, dan
// ditampilkan dengan `timeZone: "UTC"` supaya tidak tergeser balik.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Tanggal kalender WIB dari sebuah waktu, sebagai tengah malam UTC. */
export function wibCalendarDate(at: Date = new Date()): Date {
  const shifted = new Date(at.getTime() + WIB_OFFSET_MS);
  return new Date(shifted.toISOString().slice(0, 10));
}

/** Format tanggal kalender murni — WAJIB pakai ini untuk snapshotDate,
 *  jangan `toLocaleDateString()` polos yang menggeser sesuai zona pembaca. */
export function formatCalendarDate(date: Date): string {
  return date.toLocaleDateString("id-ID", { timeZone: "UTC" });
}
