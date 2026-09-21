import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/actions/notifications";

const TYPE_LABEL: Record<string, string> = {
  INVITATION: "Undangan / Lamaran",
  HEALTH_ALERT: "Peringatan Kesehatan",
  MILESTONE_DEADLINE: "Tenggat Milestone",
};

const TYPE_DOT: Record<string, string> = {
  INVITATION: "bg-primary border-primary",
  HEALTH_ALERT: "bg-health-warn border-health-warn",
  MILESTONE_DEADLINE: "bg-health-risk border-health-risk",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const notifications = await prisma.notification.findMany({
    where: { profileId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="page-narrow space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline pb-5">
        <div>
          <p className="eyebrow">AKTIVITAS</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-tight text-on-surface mt-1">
            Notifikasi
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Pemberitahuan terkait undangan tim, kondisi kesehatan proyek, dan tenggat milestone.
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="md-btn md-btn-outlined md-btn-sm">
              Tandai Semua Dibaca ({unreadCount})
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="md-card p-12 text-center space-y-2">
          <p className="font-mono text-sm text-on-surface-muted">
            Belum ada notifikasi baru untuk akunmu.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`md-card p-4 sm:p-5 transition-colors ${
                n.readAt ? "opacity-75 bg-surface" : "bg-surface-container/60 border-l-4 border-l-primary"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full border ${
                        TYPE_DOT[n.type] ?? "bg-on-surface-muted border-outline"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-muted">
                      · {new Date(n.createdAt).toLocaleString("id-ID")}
                    </span>
                  </div>

                  <p className="text-sm text-on-surface leading-relaxed">{n.message}</p>

                  {n.projectId && (
                    <div className="pt-1">
                      <Link
                        href={`/projects/${n.projectId}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Buka Proyek →
                      </Link>
                    </div>
                  )}
                </div>

                {!n.readAt && (
                  <form action={markNotificationReadAction} className="shrink-0">
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      className="md-btn md-btn-outlined md-btn-sm text-xs"
                      title="Tandai dibaca"
                    >
                      ✓ Dibaca
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
