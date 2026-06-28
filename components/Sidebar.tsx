"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// Basit monoline SVG ikonlar (stroke 2)
const icon = (path: React.ReactNode) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);

const NAV: NavItem[] = [
  { href: "/team", label: "Takımım", icon: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>) },
  { href: "/league", label: "Lig", icon: icon(<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>) },
  { href: "/transfer-market", label: "Transfer Pazarı", icon: icon(<><path d="M16 3h5v5" /><path d="M21 3l-7 7" /><path d="M8 21H3v-5" /><path d="M3 21l7-7" /></>) },
  { href: "/scouting", label: "Scouting", icon: icon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>) },
  { href: "/youth-academy", label: "Alt Yapı", icon: icon(<><path d="M12 2v8" /><path d="M5 10c0 4 3 7 7 7s7-3 7-7" /><path d="M5 10a7 7 0 0 1 14 0" /><path d="M12 17v5" /></>) },
  { href: "/cmp-shop", label: "CMP Mağazası", icon: icon(<><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></>) },
];

export default function Sidebar({ teamName, username }: { teamName?: string; username?: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 bg-bg-sidebar border-r border-border-cm flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-[30px] h-[30px] bg-emerald rotate-45 rounded-[6px]" />
        <div className="leading-none">
          <div className="font-display font-extrabold text-[15px] tracking-[1.5px]">CHAMPION</div>
          <div className="font-display font-semibold text-[11px] tracking-[4.5px] text-emerald">MANAGER</div>
        </div>
      </div>

      {/* Menü */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] transition-colors border-l-[3px] border-transparent",
                active
                  ? "bg-emerald/10 border-l-emerald text-text-cm"
                  : "text-text-muted hover:bg-[rgba(148,163,184,0.06)]"
              )}
            >
              <span className={active ? "text-emerald" : "text-text-faint"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] text-text-muted hover:bg-[rgba(148,163,184,0.06)] border-l-[3px] border-transparent"
        >
          <span className="text-text-faint">{icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>)}</span>
          Ayarlar
        </Link>
      </nav>

      {/* Kullanıcı */}
      <div className="px-3 py-4 border-t border-border-cm flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald to-blue-cm" />
        <div className="leading-tight min-w-0">
          <div className="text-[13px] font-semibold truncate">{username ?? "Menajer"}</div>
          <div className="text-[11px] text-text-muted truncate">{teamName ?? "—"}</div>
        </div>
      </div>
    </aside>
  );
}
