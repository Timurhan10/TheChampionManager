"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_TAG: Record<string, { label: string; color: string }> = {
  transfer_offer: { label: "TR", color: "#10B981" },
  transfer_result: { label: "TR", color: "#10B981" },
  scout_complete: { label: "SC", color: "#3B82F6" },
  youth_intake: { label: "AY", color: "#F59E0B" },
  season_end: { label: "SZ", color: "#F59E0B" },
  match_soon: { label: "MÇ", color: "#94A3B8" },
  cmp_purchase: { label: "CMP", color: "#F59E0B" },
};

export default function NotificationsPanel({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const unread = items.filter((i) => !i.is_read).length;

  async function markRead() {
    setLoading(true);
    try {
      await fetch("/api/notifications/mark-read", { method: "POST" });
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-panel border border-border-cm rounded-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="section-label">Bildirimler {unread > 0 && <span className="text-emerald">({unread} yeni)</span>}</div>
        {unread > 0 && (
          <button onClick={markRead} disabled={loading} className="text-xs text-text-muted hover:text-text-cm disabled:opacity-50">
            Tümünü okundu işaretle
          </button>
        )}
      </div>
      <div className="space-y-2 max-h-[220px] overflow-y-auto">
        {items.length === 0 && <div className="text-center text-text-muted text-sm py-4">Bildirim yok.</div>}
        {items.map((n) => {
          const tag = TYPE_TAG[n.type] ?? TYPE_TAG.match_soon;
          return (
            <div key={n.id} className={`flex items-start gap-3 p-2.5 rounded-lg ${n.is_read ? "bg-panel-inset/40" : "bg-panel-inset"}`}>
              <span className="text-[9px] font-bold w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: `${tag.color}22`, color: tag.color }}>{tag.label}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium flex items-center gap-2">
                  {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-emerald shrink-0" />}
                  {n.title}
                </div>
                {n.body && <div className="text-xs text-text-muted mt-0.5">{n.body}</div>}
                <div className="text-[10px] text-text-faint mt-1">{new Date(n.created_at).toLocaleString("tr-TR")}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
