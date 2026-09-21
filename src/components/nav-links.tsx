"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/projects", label: "Proyek" },
  { href: "/work", label: "Work" },
  { href: "/profile", label: "Profil" },
  { href: "/security", label: "Keamanan" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1.5 font-display text-base font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
