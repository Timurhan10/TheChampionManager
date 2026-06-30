"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { averageRating } from "@/lib/player-generator";
import { POSITION_COLORS, ratingColor } from "@/lib/attributes";
import type { Player, Tactics, Position } from "@/types/game";
import { cn } from "@/lib/utils";

type Slot = { role: Position; x: number; y: number };

const FORMATIONS: Record<string, Slot[]> = {
  "4-4-2": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 16, y: 72 }, { role: "DF", x: 38, y: 74 }, { role: "DF", x: 62, y: 74 }, { role: "DF", x: 84, y: 72 },
    { role: "MF", x: 16, y: 48 }, { role: "MF", x: 38, y: 50 }, { role: "MF", x: 62, y: 50 }, { role: "MF", x: 84, y: 48 },
    { role: "FW", x: 36, y: 24 }, { role: "FW", x: 64, y: 24 },
  ],
  "4-3-3": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 16, y: 72 }, { role: "DF", x: 38, y: 74 }, { role: "DF", x: 62, y: 74 }, { role: "DF", x: 84, y: 72 },
    { role: "MF", x: 28, y: 50 }, { role: "MF", x: 50, y: 52 }, { role: "MF", x: 72, y: 50 },
    { role: "FW", x: 22, y: 26 }, { role: "FW", x: 50, y: 22 }, { role: "FW", x: 78, y: 26 },
  ],
  "4-2-3-1": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 16, y: 74 }, { role: "DF", x: 38, y: 76 }, { role: "DF", x: 62, y: 76 }, { role: "DF", x: 84, y: 74 },
    { role: "MF", x: 36, y: 58 }, { role: "MF", x: 64, y: 58 },
    { role: "MF", x: 24, y: 40 }, { role: "MF", x: 50, y: 38 }, { role: "MF", x: 76, y: 40 },
    { role: "FW", x: 50, y: 22 },
  ],
  "3-5-2": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 28, y: 74 }, { role: "DF", x: 50, y: 76 }, { role: "DF", x: 72, y: 74 },
    { role: "MF", x: 12, y: 50 }, { role: "MF", x: 32, y: 52 }, { role: "MF", x: 50, y: 54 }, { role: "MF", x: 68, y: 52 }, { role: "MF", x: 88, y: 50 },
    { role: "FW", x: 38, y: 24 }, { role: "FW", x: 62, y: 24 },
  ],
  "5-3-2": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 10, y: 72 }, { role: "DF", x: 30, y: 76 }, { role: "DF", x: 50, y: 78 }, { role: "DF", x: 70, y: 76 }, { role: "DF", x: 90, y: 72 },
    { role: "MF", x: 28, y: 50 }, { role: "MF", x: 50, y: 52 }, { role: "MF", x: 72, y: 50 },
    { role: "FW", x: 38, y: 26 }, { role: "FW", x: 62, y: 26 },
  ],
  "4-1-4-1": [
    { role: "GK", x: 50, y: 92 },
    { role: "DF", x: 16, y: 74 }, { role: "DF", x: 38, y: 76 }, { role: "DF", x: 62, y: 76 }, { role: "DF", x: 84, y: 74 },
    { role: "MF", x: 50, y: 60 },
    { role: "MF", x: 16, y: 44 }, { role: "MF", x: 38, y: 44 }, { role: "MF", x: 62, y: 44 }, { role: "MF", x: 84, y: 44 },
    { role: "FW", x: 50, y: 24 },
  ],
};

const SEGMENTS = {
  mentality: { label: "Mentalite", options: [["defensive", "Savunmacı"], ["balanced", "Dengeli"], ["attacking", "Hücumcu"]] },
  pressing: { label: "Pressing", options: [["low", "Düşük"], ["medium", "Orta"], ["high", "Yüksek"]] },
  tempo: { label: "Tempo", options: [["slow", "Yavaş"], ["normal", "Normal"], ["fast", "Hızlı"]] },
  pass_style: { label: "Geçiş", options: [["short", "Kısa"], ["mixed", "Karma"], ["long", "Uzun"]] },
} as const;

function shortName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : name;
}

interface DragItem { playerId: string; from: "bench" | number; }

export default function TacticsBoard({ players, initial }: { players: Player[]; initial: Tactics | null }) {
  const [formation, setFormation] = useState(initial?.formation ?? "4-4-2");
  const [mentality, setMentality] = useState(initial?.mentality ?? "balanced");
  const [pressing, setPressing] = useState(initial?.pressing ?? "medium");
  const [tempo, setTempo] = useState(initial?.tempo ?? "normal");
  const [passStyle, setPassStyle] = useState(initial?.pass_style ?? "mixed");
  const [lineup, setLineup] = useState<Record<string, string>>(initial?.lineup ?? {});
  const [subs, setSubs] = useState<string[]>(initial?.substitutes ?? []);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [pitchSize, setPitchSize] = useState<"sm" | "md">("sm");

  const slots = FORMATIONS[formation];
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const usedIds = useMemo(() => new Set(Object.values(lineup).filter(Boolean)), [lineup]);
  const dragRef = useRef<DragItem | null>(null);

  // Otomatik kayıt
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSaveState("saving");
    const t = setTimeout(async () => {
      await fetch("/api/tactics/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formation, mentality, pressing, tempo, pass_style: passStyle, lineup, substitutes: subs }),
      }).catch(() => {});
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    }, 700);
    return () => clearTimeout(t);
  }, [formation, mentality, pressing, tempo, passStyle, lineup, subs]);

  function placeInSlot(slotIdx: number, playerId: string) {
    setLineup((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (next[k] === playerId) delete next[k];
      if (playerId) next[String(slotIdx)] = playerId; else delete next[String(slotIdx)];
      return next;
    });
    setSubs((prev) => prev.filter((id) => id !== playerId));
  }

  function removeFromLineup(playerId: string) {
    setLineup((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (next[k] === playerId) delete next[k];
      return next;
    });
  }

  // --- Drag & drop ---
  function onDragStart(item: DragItem) { dragRef.current = item; }
  function onDropSlot(slotIdx: number) {
    const item = dragRef.current;
    if (!item) return;
    const target = lineup[String(slotIdx)];
    if (typeof item.from === "number") {
      // Slot ↔ slot takas
      setLineup((prev) => {
        const next = { ...prev };
        next[String(slotIdx)] = item.playerId;
        if (target) next[String(item.from)] = target; else delete next[String(item.from)];
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

  function autoFill() {
    // Pozisyona uygun, en yüksek rating'li 11 oyuncuyu otomatik yerleştir
    const next: Record<string, string> = {};
    const used = new Set<string>();
    const pool = [...players].sort((a, b) => averageRating(b) - averageRating(a));
    slots.forEach((slot, i) => {
      let pick = pool.find((p) => !used.has(p.id) && p.position === slot.role);
      if (!pick) pick = pool.find((p) => !used.has(p.id));
      if (pick) { next[String(i)] = pick.id; used.add(pick.id); }
    });
    setLineup(next);
  }

  const benchPlayers = players.filter((p) => !usedIds.has(p.id));
  const pitchW = pitchSize === "sm" ? "max-w-[360px]" : "max-w-[460px]";

  return (
    <div className="grid grid-cols-[150px_1fr_240px] gap-4">
      {/* Diziliş */}
      <div>
        <div className="section-label mb-2">Diziliş</div>
        <div className="space-y-1.5">
          {Object.keys(FORMATIONS).map((f) => (
            <button key={f} onClick={() => setFormation(f)}
              className={cn("w-full py-2.5 rounded-lg text-sm font-display font-bold transition-colors border",
                formation === f ? "bg-emerald/15 border-emerald text-emerald" : "bg-panel-inset border-border-cm text-text-muted hover:text-text-cm")}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={autoFill} className="w-full mt-3 py-2 rounded-lg text-xs font-semibold bg-blue-cm/15 border border-blue-cm text-blue-cm-bright hover:bg-blue-cm/25">
          Otomatik Diz
        </button>
        <div className="mt-3 text-[11px] text-text-faint">
          {saveState === "saving" && "Kaydediliyor…"}
          {saveState === "saved" && <span className="text-emerald">✓ Kaydedildi</span>}
        </div>
      </div>

      {/* Saha */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2 self-end">
          <span className="text-[11px] text-text-faint">Saha:</span>
          {(["sm", "md"] as const).map((s) => (
            <button key={s} onClick={() => setPitchSize(s)}
              className={cn("px-2 py-0.5 rounded text-[11px] font-semibold", pitchSize === s ? "bg-emerald text-emerald-ink" : "bg-panel-inset text-text-muted")}>
              {s === "sm" ? "Küçük" : "Büyük"}
            </button>
          ))}
        </div>

        <div className={cn("relative w-full aspect-[3/4] rounded-card overflow-hidden border border-border-cm", pitchW)}
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
            return (
              <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); onDropSlot(i); }}>
                <div
                  draggable={!!player}
                  onDragStart={() => player && onDragStart({ playerId: player.id, from: i })}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold border-2 cursor-grab active:cursor-grabbing"
                  style={{ background: "#0C1524", borderColor: color.color, color: player ? "#F1F5F9" : color.color }}>
                  {player ? averageRating(player) : slot.role}
                </div>
                {player ? (
                  <Link href={`/player/${player.id}`} className="text-[9px] text-white/90 bg-black/40 rounded px-1 hover:text-emerald max-w-[78px] truncate">
                    {shortName(player.name)}
                  </Link>
                ) : (
                  <span className="text-[9px] text-white/40">{slot.role}</span>
                )}
              </div>
            );
          })}
          <div className="absolute bottom-2 left-2 text-xs font-display font-bold px-2 py-1 rounded bg-black/40">{formation}</div>
        </div>
        <div className="mt-1.5 text-[11px] text-text-faint text-center">
          Seçili: {usedIds.size}/11 · Yedekten sahaya <b>sürükle</b>, isimle profile gir. Maça kadar serbest.
        </div>
      </div>

      {/* Ayarlar + yedekler */}
      <div className="space-y-4">
        {(Object.keys(SEGMENTS) as (keyof typeof SEGMENTS)[]).map((key) => {
          const conf = SEGMENTS[key];
          const value = key === "mentality" ? mentality : key === "pressing" ? pressing : key === "tempo" ? tempo : passStyle;
          const setter = key === "mentality" ? setMentality : key === "pressing" ? setPressing : key === "tempo" ? setTempo : setPassStyle;
          return (
            <div key={key}>
              <div className="section-label mb-1.5">{conf.label}</div>
              <div className="flex gap-1 bg-panel-inset rounded-lg p-1">
                {conf.options.map(([val, label]) => (
                  <button key={val} onClick={() => setter(val)}
                    className={cn("flex-1 py-1.5 rounded text-[11px] font-semibold transition-colors",
                      value === val ? "bg-emerald text-emerald-ink" : "text-text-muted hover:text-text-cm")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div onDragOver={(e) => e.preventDefault()} onDrop={onDropBench}>
          <div className="section-label mb-1.5">Yedek Kulübesi ({benchPlayers.length})</div>
          <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
            {benchPlayers.map((p) => (
              <div key={p.id} draggable onDragStart={() => onDragStart({ playerId: p.id, from: "bench" })}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] bg-panel-inset border border-transparent hover:border-border-cm cursor-grab active:cursor-grabbing">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center" style={{ background: POSITION_COLORS[p.position].bg, color: POSITION_COLORS[p.position].color }}>{p.position}</span>
                  <Link href={`/player/${p.id}`} className="truncate hover:text-emerald" onClick={(e) => e.stopPropagation()}>{shortName(p.name)}</Link>
                </span>
                <span className="font-display font-bold" style={{ color: ratingColor(averageRating(p)) }}>{averageRating(p)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
