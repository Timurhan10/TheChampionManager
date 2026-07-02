"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Menü grupları: açık/kapalı durumu localStorage'da saklanır; aktif sayfanın grubu otomatik açılır.
const GROUPS: { key: string; label: string; icon: keyof typeof ICONS; items: [string, string][] }[] = [
  { key: "team", label: "Takımım", icon: "team", items: [["/team", "Kadro"], ["/first-eleven", "İlk 11"], ["/tactics", "Taktik"], ["/training", "Antrenman"], ["/youth-academy", "Alt Yapı"]] },
  { key: "transfer", label: "Transfer", icon: "transfer", items: [["/transfer-market", "Transfer Pazarı"], ["/scouting", "Scouting"]] },
  { key: "club", label: "Kulüp", icon: "league", items: [["/league", "Lig"], ["/friendlies", "Hazırlık Maçları"], ["/tasks", "Görevler"], ["/cmp-shop", "CMP Mağazası"]] },
];
const LS_KEY = "cm-sidebar-groups";

const icon = (path: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const ICONS = {
  team: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>),
  league: icon(<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>),
  transfer: icon(<><path d="M16 3h5v5" /><path d="M21 3l-7 7" /><path d="M8 21H3v-5" /><path d="M3 21l7-7" /></>),
  scout: icon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
  youth: icon(<><path d="M12 2v8" /><path d="M5 10c0 4 3 7 7 7s7-3 7-7" /><path d="M5 10a7 7 0 0 1 14 0" /><path d="M12 17v5" /></>),
  friendly: icon(<><circle cx="12" cy="12" r="10" /><path d="M12 2a14 14 0 0 0 0 20" /><path d="M12 2a14 14 0 0 1 0 20" /><path d="M2 12h20" /></>),
  shop: icon(<><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></>),
  settings: icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>),
  admin: icon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>),
  chevron: icon(<path d="m6 9 6 6 6-6" />),
  home: icon(<><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h11V10" /><path d="M9 20v-6h4v6" /></>),
  training: icon(<><path d="M6.5 6.5 17.5 17.5" /><path d="m21 21-1.5-1.5" /><path d="M3 3l1.5 1.5" /><path d="M18 6l3-3" /><path d="m3 21 3-3" /><path d="M6.5 6.5 3 10l4 4 3.5-3.5" /><path d="M17.5 17.5 21 14l-4-4-3.5 3.5" /></>),
};

export default function Sidebar({ teamName, username, isAdmin = false, open = false, onNavigate }: { teamName?: string; username?: string; isAdmin?: boolean; open?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  // Aktif sayfanın grubunu bul (oyuncu profili Takımım altında sayılır)
  const activeGroup = GROUPS.find((g) =>
    g.items.some(([href]) => pathname === href || pathname.startsWith(href + "/"))
  )?.key ?? (pathname.startsWith("/player") ? "team" : null);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    team: true, transfer: false, club: false,
    ...(activeGroup ? { [activeGroup]: true } : {}),
  }));

  // Kayıtlı durumu yükle. Aktif grup DAYATILMAZ: kullanıcı kapatıp yenilediyse
  // kapalı kalır (initializer'daki açılış sadece kayıt yokken ilk izlenim).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
      setOpenGroups((prev) => ({ ...prev, ...saved }));
    } catch { /* yok say */ }
  }, []);

  // Sayfa DEĞİŞİNCE yeni sayfanın grubunu otomatik aç (Sidebar persistent layout'ta
  // mount kaldığı için mount-only effect navigasyonu görmez). Mount'ta koşmaz ki
  // yenilemede kayıtlı kapalı durum ezilmesin.
  const prevGroup = useRef(activeGroup);
  useEffect(() => {
    if (activeGroup && activeGroup !== prevGroup.current) {
      setOpenGroups((prev) => (prev[activeGroup] ? prev : { ...prev, [activeGroup]: true }));
    }
    prevGroup.current = activeGroup;
  }, [activeGroup]);

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* yok say */ }
      return next;
    });
  }

  const item = (href: string, label: string, ic: React.ReactNode) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link key={href} href={href} onClick={onNavigate}
        className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] transition-colors border-l-[3px] border-transparent",
          active ? "bg-emerald/10 border-l-emerald text-text-cm" : "text-text-muted hover:bg-[rgba(148,163,184,0.06)]")}>
        <span className={active ? "text-emerald" : "text-text-faint"}>{ic}</span>
        {label}
      </Link>
    );
  };

  const subItem = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link key={href} href={href} onClick={onNavigate}
        className={cn("flex items-center gap-2 pl-11 pr-3 py-2 rounded-lg text-[13px] transition-colors",
          active ? "text-emerald font-medium" : "text-text-muted hover:text-text-cm")}>
        <span className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-emerald" : "bg-text-faint")} />
        {label}
      </Link>
    );
  };

  return (
    <aside className={cn(
      "fixed md:static z-40 top-0 left-0 h-full w-[220px] shrink-0 bg-bg-sidebar border-r border-border-cm flex flex-col transition-transform duration-200 md:translate-x-0",
      open ? "translate-x-0" : "-translate-x-full")}>
      <Link href="/dashboard" onClick={onNavigate} className="px-5 py-5 flex items-center gap-3 hover:opacity-90 transition-opacity" title="Ana Ekran">
        <div className="w-[30px] h-[30px] bg-emerald rotate-45 rounded-[6px]" />
        <div className="leading-none">
          <div className="font-display font-extrabold text-[15px] tracking-[1.5px]">CHAMPION</div>
          <div className="font-display font-semibold text-[11px] tracking-[4.5px] text-emerald">MANAGER</div>
        </div>
      </Link>

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {item("/dashboard", "Ana Ekran", ICONS.home)}

        {GROUPS.map((g) => {
          const groupActive = g.key === activeGroup;
          const isOpen = !!openGroups[g.key];
          return (
            <div key={g.key}>
              <button onClick={() => toggleGroup(g.key)}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] transition-colors border-l-[3px] border-transparent",
                  groupActive ? "bg-emerald/10 border-l-emerald text-text-cm" : "text-text-muted hover:bg-[rgba(148,163,184,0.06)]")}>
                <span className={groupActive ? "text-emerald" : "text-text-faint"}>{ICONS[g.icon]}</span>
                {g.label}
                <span className={cn("ml-auto text-text-faint transition-transform", isOpen && "rotate-180")}>{ICONS.chevron}</span>
              </button>
              {isOpen && (
                <div className="space-y-0.5 py-0.5">
                  {g.items.map(([href, label]) => subItem(href, label))}
                </div>
              )}
            </div>
          );
        })}

        {isAdmin && item("/admin", "Admin", ICONS.admin)}
        {item("/settings", "Ayarlar", ICONS.settings)}
      </nav>

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
