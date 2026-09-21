import { noticeMessage } from "@/lib/action-notice";

// Dipasang di tiap halaman yang menerima form Server Action dengan jalur
// penolakan (lihat src/lib/action-notice.ts). Server Action redirect ke
// `?e=KODE`, halaman meneruskan searchParams.e ke sini.
export function ActionNotice({ code }: { code: string | undefined }) {
  const message = noticeMessage(code);
  if (!message) return null;

  return (
    <div className="md-card mb-4 border-error bg-error-container p-3 text-sm text-on-error-container">
      {message}
    </div>
  );
}
