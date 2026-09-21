import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { signOutAction } from "@/app/actions/auth";
import { NavLinks } from "@/components/nav-links";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationPopover } from "@/components/notification-popover";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const notifications = user
    ? await prisma.notification.findMany({
        where: { profileId: user.id },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { project: { select: { title: true, goal: true } } },
      })
    : [];

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const profile = user
    ? await prisma.profile.findUnique({
        where: { id: user.id },
        select: { fullName: true },
      })
    : null;

  const userInitials = profile?.fullName
    ? getInitials(profile.fullName)
    : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : "FS";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-outline bg-surface sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/projects" className="wordmark">
            <b className="wordmark-logo">t</b>
            <span>TETHER</span>
          </Link>

          {/* Desktop Nav & Actions */}
          <div className="hidden items-center gap-5 md:flex">
            <nav className="flex items-center gap-1">
              <NavLinks />
            </nav>

            <div className="flex items-center gap-3 border-l border-outline pl-4">
              <ThemeToggle compact />

              {user && (
                <NotificationPopover
                  notifications={notifications}
                  unreadCount={unreadCount}
                />
              )}

              {user && (
                <Link
                  href="/profile"
                  aria-label={`Profil ${profile?.fullName ?? "saya"}`}
                  className="user-dot"
                >
                  {userInitials}
                </Link>
              )}

              {user && (
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="md-btn md-btn-text md-btn-sm text-xs text-on-surface-variant hover:text-on-surface"
                  >
                    Keluar
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Mobile Nav & Actions */}
          {user && (
            <div className="flex items-center gap-2.5 md:hidden">
              <ThemeToggle compact />
              <NotificationPopover
                notifications={notifications}
                unreadCount={unreadCount}
              />
              <MobileNav unreadCount={unreadCount} signOutAction={signOutAction} />
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
