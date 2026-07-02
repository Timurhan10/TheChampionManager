"use client";

// Ortak diziliş editörü çekirdeği — TEK KURAL TEK YER.
// TacticsBoard ve FirstElevenEditor aynı slot yerleştirme / takas / sürükle-bırak /
// otomatik dizme mantığını ve saha çizimini buradan kullanır; davranış farkları
// (talimat çarkı, dokun-seç halkası) prop'larla verilir.
import { useMemo, useRef } from "react";
import { overallRating } from "@/lib/player-generator";
import { POSITION_COLORS } from "@/lib/attributes";
import { FORMATIONS, type Slot } from "@/lib/formations";
import type { Player } from "@/types/game";
import { cn } from "@/lib/utils";

export interface DragItem { playerId: string; from: "bench" | number; }

// --- Paylaşılan editör durumu/mantığı ---
export function useLineupEditor({
  players, lineup, setLineup, onPlace,
}: {
  players: Player[];
  lineup: Record<string, string>;
  setLineup: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onPlace?: (playerId: string) => void; // ör. İlk 11: sahaya konan oyuncuyu yedek listesinden düşür
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const usedIds = useMemo(() => new Set(Object.values(lineup).filter(Boolean)), [lineup]);
  const benchPlayers = players.filter((p) => !usedIds.has(p.id));
  const dragRef = useRef<DragItem | null>(null);
  const dragBadgeRef = useRef<HTMLElement | null>(null);

  function placeInSlot(slotIdx: number, playerId: string) {
    setLineup((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (next[k] === playerId) delete next[k];
      if (playerId) next[String(slotIdx)] = playerId; else delete next[String(slotIdx)];
      return next;
    });
    if (playerId) onPlace?.(playerId);
  }

  function swapSlots(i: number, j: number) {
    setLineup((prev) => {
      const next = { ...prev };
      const a = next[String(i)], b = next[String(j)];
      if (b) next[String(i)] = b; else delete next[String(i)];
      if (a) next[String(j)] = a; else delete next[String(j)];
      return next;
    });
  }

  function removeFromLineup(playerId: string) {
    setLineup((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (next[k] === playerId) delete next[k];
      return next;
    });
  }

  // Sürüklemede tarayıcının "link" hayaleti yerine yuvarlak numara rozeti göster.
  function onDragStart(e: React.DragEvent, item: DragItem, player?: Player) {
    dragRef.current = item;
    if (player && e.dataTransfer) {
      const color = POSITION_COLORS[player.position]?.color ?? "#10B981";
      const label = player.shirt_number ?? overallRating(player, player.position);
      const badge = document.createElement("div");
      badge.textContent = String(label);
      badge.style.cssText =
        "position:fixed;top:-140px;left:-140px;width:38px;height:38px;border-radius:9999px;" +
        "display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;" +
        "color:#F1F5F9;background:#0C1524;border:2px solid " + color + ";box-shadow:0 2px 10px rgba(0,0,0,.5);z-index:9999;font-family:sans-serif;";
      document.body.appendChild(badge);
      dragBadgeRef.current = badge;
      e.dataTransfer.setDragImage(badge, 19, 19);
      e.dataTransfer.effectAllowed = "move";
    }
  }
  function onDragEndCleanup() { dragBadgeRef.current?.remove(); dragBadgeRef.current = null; }

  function onDropSlot(slotIdx: number) {
    const item = dragRef.current;
    if (!item) return;
    if (typeof item.from === "number") {
      // Slot ↔ slot takas
      const from = item.from;
      setLineup((prev) => {
        const next = { ...prev };
        const target = next[String(slotIdx)];
        next[String(slotIdx)] = item.playerId;
        if (target) next[String(from)] = target; else delete next[String(from)];
        return next;
      });
    } else {
      placeInSlot(slotIdx, item.playerId); // yedekten geldi
    }
    dragRef.current = null;
  }
  function onDropBench() {
    const item = dragRef.current;
    if (item && typeof item.from === "number") removeFromLineup(item.playerId);
    dragRef.current = null;
  }

  // Pozisyona uygun, en yüksek rating'li 11 oyuncuyu otomatik yerleştir.
  function autoFill(slots: Slot[]) {
    const next: Record<string, string> = {};
    const used = new Set<string>();
    const pool = [...players].sort((a, b) => overallRating(b, b.position) - overallRating(a, a.position));
    slots.forEach((slot, i) => {
      let pick = pool.find((p) => !used.has(p.id) && p.position === slot.role);
      if (!pick) pick = pool.find((p) => !used.has(p.id));
      if (pick) { next[String(i)] = pick.id; used.add(pick.id); }
    });
    setLineup(next);
  }

  return { byId, usedIds, benchPlayers, placeInSlot, swapSlots, removeFromLineup, onDragStart, onDragEndCleanup, onDropSlot, onDropBench, autoFill };
}

// --- Paylaşılan saha çizimi ---
export function LineupPitch({
  formation, lineup, byId, className, slotSize = "md", selectedIdx = null,
  onSlotClick, onDragStart, onDragEndCleanup, onDropSlot, onDropBench, renderUnderSlot,
}: {
  formation: string;
  lineup: Record<string, string>;
  byId: Map<string, Player>;
  className?: string; // dış genişlik (ör. max-w-[420px])
  slotSize?: "sm" | "md";
  selectedIdx?: number | null; // dokun-seç halkası (İlk 11)
  onSlotClick?: (i: number) => void;
  onDragStart: (e: React.DragEvent, item: DragItem, player?: Player) => void;
  onDragEndCleanup: () => void;
  onDropSlot: (i: number) => void;
  onDropBench: () => void;
  renderUnderSlot?: (player: Player | undefined, slot: Slot, i: number) => React.ReactNode; // rozet altı içerik
}) {
  const slots = FORMATIONS[formation] ?? [];
  const badgeCls = slotSize === "sm" ? "w-9 h-9 text-[10px]" : "w-10 h-10 text-[11px]";
  return (
    <div className={cn("relative w-full aspect-[3/4] rounded-card overflow-hidden border border-border-cm", className)}
      style={{ background: "repeating-linear-gradient(180deg, #0f3d2a 0px, #0f3d2a 36px, #0d3525 36px, #0d3525 72px)" }}
      onDragOver={(e) => e.preventDefault()} onDrop={onDropBench}>
      <div className="absolute inset-3 border-2 border-white/20 rounded" />
      <div className="absolute left-3 right-3 top-1/2 h-0.5 bg-white/20" />
      <div className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 border-2 border-white/20 rounded-full" />
      <div className="absolute left-1/4 right-1/4 top-3 h-9 border-2 border-t-0 border-white/20" />
      <div className="absolute left-1/4 right-1/4 bottom-3 h-9 border-2 border-b-0 border-white/20" />

      {slots.map((slot, i) => {
        const pid = lineup[String(i)];
        const player = pid ? byId.get(pid) : undefined;
        const color = POSITION_COLORS[slot.role];
        const isSel = selectedIdx === i;
        return (
          <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); onDropSlot(i); }}>
            <button
              type="button"
              draggable={!!player}
              onDragStart={(e) => player && onDragStart(e, { playerId: player.id, from: i }, player)}
              onDragEnd={onDragEndCleanup}
              onClick={onSlotClick ? () => onSlotClick(i) : undefined}
              className={cn(badgeCls, "rounded-full flex items-center justify-center font-bold border-2 transition-transform",
                onSlotClick ? "active:scale-95" : "cursor-grab active:cursor-grabbing",
                isSel && "ring-2 ring-emerald ring-offset-1 ring-offset-[#0f3d2a] scale-110")}
              style={{ background: "#0C1524", borderColor: color.color, color: player ? "#F1F5F9" : color.color }}
              title={player ? `${player.name} · ${overallRating(player, player.position)}` : slot.role}>
              {player ? (player.shirt_number ?? overallRating(player, player.position)) : slot.role}
            </button>
            {renderUnderSlot
              ? renderUnderSlot(player, slot, i)
              : <span className="text-[9px] text-white/40">{slot.role}</span>}
          </div>
        );
      })}
      <div className="absolute bottom-2 left-2 text-xs font-display font-bold px-2 py-1 rounded bg-black/40">{formation}</div>
    </div>
  );
}
