"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/projects", label: "Proyek" },
  { href: "/work", label: "Work" },
  { href: "/notifications", label: "Notifikasi" },
  { href: "/profile", label: "Profil" },
  { href: "/security", label: "Keamanan" },
];

export function MobileNav({
  unreadCount,
  signOutAction,
}: {
  unreadCount: number;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Tutup menu" : "Buka menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-outline text-on-surface-variant hover:bg-surface-container"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {open ? (
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          ) : (
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <>
          <div
            className="bg-on-surface/40 fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav-panel"
            ref={panelRef}
            className="border-outline bg-surface-container-high fixed inset-x-4 top-16 z-50 space-y-1 rounded-[var(--radius-md)] border p-3 shadow-xl"
          >
            {LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-11 items-center justify-between rounded px-3 text-sm font-semibold uppercase font-display tracking-wider ${
                    active ? "bg-primary text-on-primary" : "text-on-surface-body hover:bg-surface-container"
                  }`}
                >
                  <span>{link.label}</span>
                  {link.href === "/notifications" && unreadCount > 0 && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
            <div className="flex min-h-11 items-center justify-between px-3 border-t border-outline/40 pt-1">
              <span className="text-xs font-mono text-on-surface-variant uppercase">Mode Tampilan</span>
              <ThemeToggle compact />
            </div>
            <form action={signOutAction} className="border-t border-outline/40 pt-1">
              <button
                type="submit"
                className="flex min-h-11 w-full items-center rounded px-3 text-left text-xs font-mono text-error hover:bg-error-container/20"
              >
                Keluar dari Akun
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
