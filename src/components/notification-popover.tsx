"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  projectId: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
  project?: {
    title: string;
    goal: string;
  } | null;
};

const TYPE_LABEL: Record<string, string> = {
  INVITATION: "Undangan / Lamaran",
  HEALTH_ALERT: "Kesehatan Proyek",
  MILESTONE_DEADLINE: "Tenggat Waktu",
};

const TYPE_DOT: Record<string, string> = {
  INVITATION: "bg-primary border-primary",
  HEALTH_ALERT: "bg-health-warn border-health-warn",
  MILESTONE_DEADLINE: "bg-health-risk border-health-risk",
};

export function NotificationPopover({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ""}`}
        title="Notifikasi"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-outline text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-error"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Panel Notifikasi"
          className="absolute right-0 top-full mt-2 w-[300px] sm:w-[380px] rounded-[var(--radius-md)] border border-outline bg-surface shadow-xl z-50 overflow-hidden text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-outline px-4 py-3 bg-surface-container/60">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold uppercase tracking-wider text-on-surface">
                Notifikasi
              </span>
              {unreadCount > 0 && (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-error text-on-error">
                  {unreadCount} baru
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <form action={markAllNotificationsReadAction}>
                <button
                  type="submit"
                  className="font-mono text-[10px] text-primary hover:underline uppercase font-bold"
                >
                  Tandai Semua Dibaca
                </button>
              </form>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-outline/50">
            {notifications.length === 0 ? (
              <div className="p-6 text-center font-mono text-xs text-on-surface-muted">
                Belum ada notifikasi baru.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 space-y-1.5 transition-colors ${
                    n.readAt ? "opacity-75 bg-surface" : "bg-surface-container/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full border ${
                          TYPE_DOT[n.type] ?? "bg-on-surface-muted border-outline"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {TYPE_LABEL[n.type] ?? n.type}
                      </span>
                    </div>
                    <span className="font-mono text-[9px] text-on-surface-muted">
                      {new Date(n.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-on-surface leading-relaxed">{n.message}</p>

                  <div className="flex items-center justify-between pt-1 font-mono text-[11px]">
                    {n.projectId ? (
                      <Link
                        href={`/projects/${n.projectId}`}
                        onClick={() => setIsOpen(false)}
                        className="text-primary hover:underline font-bold"
                      >
                        {n.project ? (
                          <span className="flex flex-col gap-0.5">
                            <span className="text-[11px] leading-tight font-display tracking-wide uppercase">{n.project.title}</span>
                            <span className="text-[9px] text-on-surface-muted font-normal normal-case leading-tight line-clamp-1">{n.project.goal}</span>
                          </span>
                        ) : (
                          "Buka Proyek →"
                        )}
                      </Link>
                    ) : (
                      <span />
                    )}

                    {!n.readAt && (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button
                          type="submit"
                          className="text-on-surface-muted hover:text-on-surface hover:underline text-[10px]"
                        >
                          ✓ Tandai dibaca
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-outline px-4 py-2.5 bg-surface-container/30 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="font-mono text-xs font-semibold text-primary hover:underline"
            >
              Lihat Riwayat Lengkap →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
