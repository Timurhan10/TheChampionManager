"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchEvent } from "@/types/game";
import { cn } from "@/lib/utils";

const TAG: Record<string, { label: string; color: string }> = {
  goal: { label: "GOL", color: "#10B981" },
  shot: { label: "ŞUT", color: "#38BDF8" },
  save: { label: "KURT", color: "#A78BFA" },
  miss: { label: "AUT", color: "#94A3B8" },
  tackle: { label: "MÜD", color: "#F59E0B" },
  yellow: { label: "SK", color: "#F59E0B" },
  red: { label: "KRT", color: "#EF4444" },
  sub: { label: "DEĞ", color: "#3B82F6" },
  counter: { label: "KONTRA", color: "#F97316" },
  corner: { label: "KRN", color: "#94A3B8" },
  foul: { label: "FAUL", color: "#94A3B8" },
  chance: { label: "FIRSAT", color: "#94A3B8" },
  kickoff: { label: "BAŞLA", color: "#94A3B8" },
};

const PIN_ICON: Record<string, string> = { goal: "⚽", yellow: "🟨", red: "🟥", sub: "🔁" };
const FLOW_MS = 4000; // akış satırındaki olayın görünme süresi

// Maç haber bandı: son olay kayarak gelir, ~4 sn sonra söner; gol/kart/önemli
// olaylar kalıcı rozet olarak üstte birikir. Tüm log katlanabilir.
export default function MatchTicker({ events }: { events: MatchEvent[] }) {
  const [flow, setFlow] = useState<MatchEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const queueRef = useRef<MatchEvent[]>([]);
  const seenRef = useRef(0);
  const busyRef = useRef(false);

  // Yeni olayları kuyruğa al
  useEffect(() => {
    if (events.length > seenRef.current) {
      queueRef.current.push(...events.slice(seenRef.current));
      seenRef.current = events.length;
      pump();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  function pump() {
    if (busyRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;
    setFlow(next);
    setVisible(true);
    // birikme varsa daha hızlı geç
    const hold = queueRef.current.length > 2 ? 1400 : FLOW_MS;
    setTimeout(() => {
      setVisible(false);
      setTimeout(() => { busyRef.current = false; pump(); }, 250);
    }, hold);
  }

  const pinned = events.filter((e) => e.type === "goal" || e.type === "yellow" || e.type === "red" || e.type === "sub");

  return (
    <div className="mt-1.5">
      {/* Kalıcı rozetler (gol/kart/değişiklik) */}
      {pinned.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5">
          {pinned.map((e, i) => {
            const tag = TAG[e.type];
            return (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                style={{ borderColor: `${tag.color}66`, background: `${tag.color}14`, color: tag.color }}>
                <span>{PIN_ICON[e.type] ?? "•"}</span>
                <span className="text-text-2">{e.minute}'</span>
                {e.playerName && <span className="text-text-2 max-w-[110px] truncate">{e.playerName}</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Akış satırı (son olay — kayar gelir, söner) */}
      <div className="h-10 rounded-lg bg-black/60 border border-border-cm overflow-hidden relative flex items-center">
        {flow ? (
          <div className={cn("flex items-center gap-2.5 px-3 w-full transition-all duration-300",
            visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6")}>
            <span className="font-display font-bold text-sm text-text-2 shrink-0">{flow.minute}'</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: `${(TAG[flow.type] ?? TAG.chance).color}22`, color: (TAG[flow.type] ?? TAG.chance).color }}>
              {(TAG[flow.type] ?? TAG.chance).label}
            </span>
            <span className={cn("text-sm truncate", (flow.importance ?? 0) >= 2 && "font-semibold")}>{flow.text}</span>
          </div>
        ) : (
          <span className="px-3 text-sm text-text-faint">Anlık olaylar burada akacak…</span>
        )}
        <button onClick={() => setLogOpen((o) => !o)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] px-2 py-1 rounded border border-border-cm text-text-muted hover:text-text-cm bg-bg-base/60">
          {logOpen ? "Kapat" : "Tümü"}
        </button>
      </div>

      {/* Tüm olaylar (katlanabilir) */}
      {logOpen && (
        <div className="mt-1.5 bg-panel border border-border-cm rounded-lg divide-y divide-border-soft max-h-[200px] overflow-y-auto">
          {events.length === 0 && <div className="px-3 py-4 text-center text-text-muted text-sm">Henüz olay yok.</div>}
          {[...events].reverse().map((e, i) => {
            const tag = TAG[e.type] ?? TAG.chance;
            return (
              <div key={i} className={cn("flex items-center gap-2.5 px-3 py-1.5", (e.importance ?? 0) >= 2 && "bg-emerald/5")}>
                <span className="font-display font-bold text-xs w-7 text-text-2">{e.minute}'</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${tag.color}22`, color: tag.color }}>{tag.label}</span>
                <span className={cn("text-xs", (e.importance ?? 0) >= 2 && "font-semibold")}>{e.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
