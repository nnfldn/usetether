"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProjectTabs({
  projectId,
  isMember,
  isOwner,
}: {
  projectId: string;
  isMember?: boolean;
  isOwner?: boolean;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const allTabs = [
    { href: base, label: "Ringkasan" },
    { href: `${base}/team`, label: "Tim" },
    { href: `${base}/workspace`, label: "Ruang Kerja" },
    { href: `${base}/discussion`, label: "Diskusi" },
  ];
  // Tim/Ruang Kerja/Diskusi hanya ditampilkan untuk anggota
  const tabs = isMember ? allTabs : allTabs.slice(0, 1);
  
  if (isOwner) {
    tabs.push({ href: `${base}/settings`, label: "Pengaturan" });
  }

  return (
    <div className="flex overflow-x-auto border border-outline" role="tablist">
      {tabs.map((tab, idx) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-current={active ? "page" : undefined}
            aria-selected={active}
            className={[
              "whitespace-nowrap px-5 py-2.5 text-sm font-semibold uppercase tracking-widest",
              "font-['Barlow_Condensed']",
              idx < tabs.length - 1 ? "border-r border-outline" : "",
              active
                ? "bg-primary text-on-primary"
                : "bg-surface text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
