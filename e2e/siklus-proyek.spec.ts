import { test, expect } from "@playwright/test";
import { login } from "./helpers";
import { PENANDA_E2E } from "./konstanta";

/**
 * Siklus 4C dalam satu proyek sekali pakai: Compose -> Collaborate.
 *
 * Menjalankan Server Action yang SELAMA INI TIDAK PERNAH diklik lewat UI
 * sama sekali — cuma diuji lewat skrip yang MENIRU logikanya lewat Prisma
 * langsung. Bug "nama field form tidak cocok dengan formData.get()" lolos
 * dari build, lint, dan seluruh 65 unit test; satu-satunya yang
 * menangkapnya adalah menekan tombolnya sungguhan.
 *
 * Proyeknya dibuat sendiri oleh test dan dihapus di global-teardown, jadi
 * data demo tidak tersentuh sama sekali.
 */

// Akun yang tidak dipakai skenario demo mana pun — supaya kalaupun ada
// sisa data, tidak mengotori akun yang akan dipakai di depan juri.
const AKUN_UJI = "tegar.dewi@tether.test";

function tanggalDepan(hariDariSekarang: number): string {
  const d = new Date(Date.now() + hariDariSekarang * 86_400_000);
  return d.toISOString().slice(0, 10);
}

test("siklus proyek: buat -> milestone -> task -> penanda kedua -> diskusi", async ({
  page,
}) => {
  // 8 langkah berurutan (masing-masing navigasi + submit form + tunggu
  // render) mepet ke batas default 30s di dev mode (Turbopack lebih lambat
  // dari build produksi) — realisasi terukur ~33s tanpa ada langkah yang
  // benar-benar macet. Dinaikkan khusus test ini, bukan default global,
  // supaya test lain tetap ketat kalau benar-benar macet.
  test.setTimeout(60_000);

  const judul = `${PENANDA_E2E} Siklus ${Date.now()}`;

  await login(page, AKUN_UJI);

  // --- 1. Buat proyek (createProjectAction) ---
  await page.goto("/projects/new");
  await page.getByLabel("Judul proyek").fill(judul);
  await page
    .getByLabel("Tujuan proyek")
    .fill("Proyek sekali pakai milik test E2E. Dihapus otomatis di teardown.");
  await page.getByRole("button", { name: "Buat proyek" }).click();

  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const projectId = new URL(page.url()).pathname.split("/")[2];
  await expect(page.getByRole("heading", { name: judul })).toBeVisible();

  // --- 2. Milestone (createMilestoneAction) ---
  await page.goto(`/projects/${projectId}/workspace`);
  await page.getByText("+ Buat milestone baru").click();
  const formMilestone = page.locator("form").filter({ hasText: "Tenggat" }).first();
  await formMilestone.getByLabel("Judul").fill("Milestone uji E2E");
  await formMilestone.getByLabel("Tenggat").fill(tanggalDepan(14));
  await formMilestone.getByRole("button", { name: "Buat" }).click();
  await expect(page.getByText("Milestone uji E2E")).toBeVisible();

  // --- 3. Task (createTaskAction) ---
  await page.getByText("+ Tambah task").first().click();
  await page.getByPlaceholder("Judul task").fill("Task uji E2E");
  await page.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText("Task uji E2E")).toBeVisible();

  // --- 4. Pindahkan ke Menunggu Konfirmasi (setTaskStatusAction) ---
  // Task TIDAK BISA langsung jadi DONE — itu inti pagar anti-gaming
  // "penanda kedua": TaskStatus DONE sengaja tidak ada di daftar status
  // yang boleh dipilih sendiri (lihat TASK_STATUSES di actions/workspace.ts).
  await page.getByRole("button", { name: /Menunggu Konfirmasi/i }).first().click();
  await expect(
    page.getByRole("button", { name: "✓ Konfirmasi selesai" }),
  ).toBeVisible();

  // --- 5. Konfirmasi (confirmTaskAction) ---
  // Di sini penulis task dan konfirmatornya kebetulan orang yang sama
  // (pemilik proyek sendirian). Yang diuji adalah JALURNYA berfungsi;
  // aturan siapa yang berwenang sudah dikunci di smoke test + unit test.
  await page.getByRole("button", { name: "✓ Konfirmasi selesai" }).click();
  await expect(
    page.getByRole("button", { name: "✓ Konfirmasi selesai" }),
  ).toHaveCount(0);

  // --- 6. Progress update (postProgressUpdateAction) ---
  await page.goto(`/projects/${projectId}`);
  const teksUpdate = `Update dari test E2E ${Date.now()}`;
  await page.getByPlaceholder("Bagikan progres singkat ke tim…").fill(teksUpdate);
  await page.getByRole("button", { name: "Kirim" }).first().click();
  await expect(page.getByText(teksUpdate)).toBeVisible();

  // --- 7. Komentar diskusi (postCommentAction) ---
  const teksKomentar = `Komentar dari test E2E ${Date.now()}`;
  const formDiskusi = page.locator("section").filter({ hasText: "Diskusi" }).last();
  await formDiskusi.getByRole("textbox").fill(teksKomentar);
  await formDiskusi.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText(teksKomentar)).toBeVisible();

  // --- 8. Tutup proyek (completeProjectAction) — fase "Complete" dari 4C ---
  await page.getByRole("button", { name: "Tandai proyek selesai" }).click();
  // "Selesai", bukan "COMPLETED" — rombak UI/UX B1.3 mengganti enum mentah
  // dengan label Indonesia (src/lib/labels.ts).
  await expect(page.getByText("Selesai", { exact: true })).toBeVisible();
  // Tombolnya harus hilang: proyek yang sudah ditutup tidak boleh bisa
  // ditutup dua kali.
  await expect(
    page.getByRole("button", { name: "Tandai proyek selesai" }),
  ).toHaveCount(0);

  // Setelah ditutup, form penilaian rekan seharusnya tersedia — tapi di
  // proyek ini pemiliknya sendirian, jadi tidak ada rekan untuk dinilai
  // dan bagiannya memang sengaja tidak dirender sama sekali.
  await expect(page.getByText("Penilaian rekan satu tim")).toHaveCount(0);

  // Proyek selesai tidak boleh divonis berisiko (perbaikan 4 September).
  await expect(page.getByText("Berisiko")).toHaveCount(0);
});
