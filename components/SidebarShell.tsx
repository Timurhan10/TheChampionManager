"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

// Mobilde sol menüyü açılır/kapanır yapar (off-canvas + overlay + hamburger).
// Masaüstünde (md+) menü her zaman görünür, davranış değişmez.
export default function SidebarShell({
  children, teamName, username, isAdmin,
}: {
  children: React.ReactNode;
  teamName?: string;
  username?: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobil karartma */}
      {open && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setOpen(false)} />}

      <Sidebar teamName={teamName} username={username} isAdmin={isAdmin} open={open} onNavigate={() => setOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden bg-bg-deep min-w-0">
        {/* Mobil üst bar (hamburger) */}
        <div className="md:hidden flex items-center gap-2 px-3 h-12 shrink-0 border-b border-border-cm bg-bg-sidebar">
          <button onClick={() => setOpen(true)} aria-label="Menü" className="p-2 -ml-1 text-text-2 hover:text-emerald">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <span className="font-display font-bold text-sm">Champion Manager</span>
        </div>
        {children}
      </div>
    </div>
  );
}
