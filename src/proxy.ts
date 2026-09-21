import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 mengganti nama konvensi "middleware" jadi "proxy" — fungsinya
// sama persis, cuma namanya yang berubah. File lama src/middleware.ts masih
// jalan tapi memunculkan peringatan deprekasi tiap build.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Lewati semua file statis Next.js/Tailwind dan gambar — cuma jalankan
    // pemeriksaan sesi untuk request halaman/route sungguhan.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
