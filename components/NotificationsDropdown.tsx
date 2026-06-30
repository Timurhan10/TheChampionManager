"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber, cn } from "@/lib/utils";

interface Personal { id: string; type: string; title: string; body: string | null; is_read: boolean; created_at: string; }
interface Market { id: string; player: string; from: string; to: string; amount: number; at: string; }

export default function NotificationsDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"personal" | "market">("personal");
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [market, setMarket] = useState<Market[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications/list");
      const d = await r.json();
      setPersonal(d.personal ?? []);
      setMarket(d.market ?? []);
      setUnread(d.unread ?? 0);
    } finally { setLoading(false); }
  }

  // İlk yükte sadece okunmamış sayısı için çek
  useEffect(() => { load(); }, []);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }

  async function markRead() {
    await fetch("/api/notifications/mark-read", { method: "POST" }).catch(() => {});
    setUnread(0);
    setPersonal((prev) => prev.map((p) => ({ ...p, is_read: true })));
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative w-[38px] h-[38px] rounded-lg bg-panel border border-border-cm flex items-center justify-center text-text-muted hover:text-text-cm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute top-1.5 right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-danger text-[9px] font-bold text-white flex items-center justify-center">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] bg-panel border border-border-cm rounded-card shadow-frame z-50 overflow-hidden">
          {/* Sekmeler */}
          <div className="flex border-b border-border-cm">
            {([["personal", "Bildirimler"], ["market", "Piyasa Hareketleri"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn("flex-1 py-2.5 text-xs font-semibold", tab === k ? "text-emerald border-b-2 border-emerald" : "text-text-muted")}>
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && <div className="p-4 text-center text-text-muted text-xs">Yükleniyor…</div>}

            {!loading && tab === "personal" && (
              <>
                {personal.length === 0 && <div className="p-5 text-center text-text-muted text-sm">Bildirim yok.</div>}
                {personal.map((n) => (
                  <div key={n.id} className={cn("px-4 py-2.5 border-b border-border-soft last:border-0", !n.is_read && "bg-panel-inset")}>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-emerald shrink-0" />}
                      {n.title}
                    </div>
                    {n.body && <div className="text-xs text-text-muted mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-text-faint mt-1">{new Date(n.created_at).toLocaleString("tr-TR")}</div>
                  </div>
                ))}
              </>
            )}

            {!loading && tab === "market" && (
              <>
                {market.length === 0 && <div className="p-5 text-center text-text-muted text-sm">Henüz transfer yok.</div>}
                {market.map((m) => (
                  <div key={m.id} className="px-4 py-2.5 border-b border-border-soft last:border-0">
                    <div className="text-sm"><span className="font-semibold">{m.player}</span> transfer oldu</div>
                    <div className="text-xs text-text-muted mt-0.5">{m.from} → <span className="text-emerald">{m.to}</span> · {formatNumber(m.amount)} CR</div>
                    <div className="text-[10px] text-text-faint mt-1">{m.at ? new Date(m.at).toLocaleString("tr-TR") : ""}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          {tab === "personal" && unread > 0 && (
            <button onClick={markRead} className="w-full py-2 text-xs text-text-muted hover:text-text-cm border-t border-border-cm">
              Tümünü okundu işaretle
            </button>
          )}
        </div>
      )}
    </div>
  );
}
