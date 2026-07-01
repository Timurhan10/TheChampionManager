"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { averageRating } from "@/lib/player-generator";
import { POSITION_COLORS, ratingColor } from "@/lib/attributes";
import type { Player, Tactics, PlayerInstruction } from "@/types/game";
import { FORMATIONS, shortName } from "@/lib/formations";
import { cn } from "@/lib/utils";

// Oyuncu-bazlı talimat segmentleri
const INSTR_SEGMENTS: { key: keyof PlayerInstruction; label: string; opts: [string, string][] }[] = [
  { key: "role", label: "Rol", opts: [["attacking", "Hücum"], ["balanced", "Dengeli"], ["defensive", "Savunma"]] },
  { key: "pressing", label: "Pressing", opts: [["low", "Düşük"], ["medium", "Orta"], ["high", "Yüksek"]] },
  { key: "passing", label: "Pas", opts: [["short", "Kısa"], ["mixed", "Karma"], ["long", "Uzun"]] },
  { key: "run", label: "Koşu", opts: [["forward", "İleri"], ["hold", "Tut"], ["wide", "Kanat"]] },
  { key: "risk", label: "Risk", opts: [["low", "Düşük"], ["medium", "Orta"], ["high", "Yüksek"]] },
  { key: "shooting", label: "Şut", opts: [["rare", "Az"], ["normal", "Normal"], ["often", "Sık"]] },
];
const INSTR_DEFAULT: Required<PlayerInstruction> = { role: "balanced", pressing: "medium", passing: "mixed", run: "hold", risk: "medium", shooting: "normal" };

const SEGMENTS = {
  mentality: { label: "Mentalite", options: [["defensive", "Savunmacı"], ["balanced", "Dengeli"], ["attacking", "Hücumcu"]] },
  pressing: { label: "Pressing", options: [["low", "Düşük"], ["medium", "Orta"], ["high", "Yüksek"]] },
  tempo: { label: "Tempo", options: [["slow", "Yavaş"], ["normal", "Normal"], ["fast", "Hızlı"]] },
  pass_style: { label: "Geçiş", options: [["short", "Kısa"], ["mixed", "Karma"], ["long", "Uzun"]] },
} as const;

interface DragItem { playerId: string; from: "bench" | number; }

export default function TacticsBoard({ players, initial }: { players: Player[]; initial: Tactics | null }) {
  const [formation, setFormation] = useState(initial?.formation ?? "4-4-2");
  const [mentality, setMentality] = useState(initial?.mentality ?? "balanced");
  const [pressing, setPressing] = useState(initial?.pressing ?? "medium");
  const [tempo, setTempo] = useState(initial?.tempo ?? "normal");
  const [passStyle, setPassStyle] = useState(initial?.pass_style ?? "mixed");
  const [lineup, setLineup] = useState<Record<string, string>>(initial?.lineup ?? {});
  const [subs, setSubs] = useState<string[]>(initial?.substitutes ?? []);
  const [instructions, setInstructions] = useState<Record<string, PlayerInstruction>>(initial?.player_instructions ?? {});
  const [instrFor, setInstrFor] = useState<string | null>(null); // talimat modalı açık oyuncu
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [pitchSize, setPitchSize] = useState<"sm" | "md">("sm");

  const slots = FORMATIONS[formation];
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const usedIds = useMemo(() => new Set(Object.values(lineup).filter(Boolean)), [lineup]);
  const dragRef = useRef<DragItem | null>(null);
  const dragBadgeRef = useRef<HTMLElement | null>(null);

  // Taktiği kaydet (hem otomatik hem manuel buton kullanır)
  async function saveTactics(): Promise<boolean> {
    setSaveState("saving");
    try {
      const res = await fetch("/api/tactics/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formation, mentality, pressing, tempo, pass_style: passStyle, lineup, substitutes: subs, player_instructions: instructions }),
      });
      const ok = res.ok;
      setSaveState(ok ? "saved" : "idle");
      if (ok) setTimeout(() => setSaveState("idle"), 1500);
      return ok;
    } catch {
      setSaveState("idle");
      return false;
    }
  }

  // Otomatik kayıt (debounce)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const t = setTimeout(() => { saveTactics(); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formation, mentality, pressing, tempo, passStyle, lineup, subs, instructions]);

  function setInstr(pid: string, key: keyof PlayerInstruction, val: string) {
    setInstructions((prev) => ({ ...prev, [pid]: { ...INSTR_DEFAULT, ...prev[pid], [key]: val } }));
  }

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
  // Sürükleme sırasında tarayıcının "link" hayaleti yerine yuvarlak numara rozeti göster.
  function onDragStart(e: React.DragEvent, item: DragItem, player?: Player) {
    dragRef.current = item;
    if (player && e.dataTransfer) {
      const color = POSITION_COLORS[player.position]?.color ?? "#10B981";
      const label = player.shirt_number ?? averageRating(player);
      const badge = document.createElement("div");
      badge.textContent = String(label);
      badge.style.cssText =
        "position:fixed;top:-140px;left:-140px;width:38px;height:38px;border-radius:9999px;" +
        "display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;" +
        "color:#F1F5F9;background:#0C1524;border:2px solid " + color + ";" +
        "box-shadow:0 2px 10px rgba(0,0,0,.5);z-index:9999;font-family:sans-serif;";
      document.body.appendChild(badge);
      dragBadgeRef.current = badge;
      e.dataTransfer.setDragImage(badge, 19, 19);
      e.dataTransfer.effectAllowed = "move";
    }
  }
  function onDragEndCleanup() {
    dragBadgeRef.current?.remove();
    dragBadgeRef.current = null;
  }
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

  const instrPlayer = instrFor ? byId.get(instrFor) : undefined;

  return (
    <>
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
        <button onClick={() => saveTactics()} disabled={saveState === "saving"}
          className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold bg-emerald text-emerald-ink hover:bg-emerald-bright disabled:opacity-60">
          {saveState === "saving" ? "Kaydediliyor…" : saveState === "saved" ? "✓ Kaydedildi" : "Taktiği Kaydet"}
        </button>
        <div className="mt-2 text-[11px] text-text-faint text-center">Değişiklikler otomatik de kaydedilir.</div>
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
                  onDragStart={(e) => player && onDragStart(e, { playerId: player.id, from: i }, player)}
                  onDragEnd={onDragEndCleanup}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold border-2 cursor-grab active:cursor-grabbing"
                  style={{ background: "#0C1524", borderColor: color.color, color: player ? "#F1F5F9" : color.color }}
                  title={player ? `${player.name} · ${averageRating(player)}` : slot.role}>
                  {player ? (player.shirt_number ?? averageRating(player)) : slot.role}
                </div>
                {player ? (
                  <div className="flex items-center gap-0.5">
                    <Link href={`/player/${player.id}`} draggable={false} className="text-[9px] text-white/90 bg-black/40 rounded px-1 hover:text-emerald max-w-[64px] truncate">
                      {shortName(player.name)}
                    </Link>
                    <button onClick={() => setInstrFor(player.id)} title="Talimatlar"
                      className="text-[10px] bg-black/40 rounded px-1 text-white/80 hover:text-emerald">⚙</button>
                  </div>
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
              <div key={p.id} draggable onDragStart={(e) => onDragStart(e, { playerId: p.id, from: "bench" }, p)} onDragEnd={onDragEndCleanup}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] bg-panel-inset border border-transparent hover:border-border-cm cursor-grab active:cursor-grabbing">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center" style={{ background: POSITION_COLORS[p.position].bg, color: POSITION_COLORS[p.position].color }}>{p.position}</span>
                  <Link href={`/player/${p.id}`} draggable={false} className="truncate hover:text-emerald" onClick={(e) => e.stopPropagation()}>{shortName(p.name)}</Link>
                </span>
                <span className="font-display font-bold" style={{ color: ratingColor(averageRating(p)) }}>{averageRating(p)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Oyuncu talimat modalı */}
    {instrFor && instrPlayer && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setInstrFor(null)}>
        <div className="bg-panel border border-border-cm rounded-card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display font-bold">{instrPlayer.name}</div>
              <div className="text-xs text-text-muted">Oyuncu Talimatları</div>
            </div>
            <button onClick={() => setInstrFor(null)} className="text-text-faint hover:text-text-cm">✕</button>
          </div>
          <div className="space-y-3">
            {INSTR_SEGMENTS.map((seg) => {
              const cur = instructions[instrFor]?.[seg.key] ?? INSTR_DEFAULT[seg.key];
              return (
                <div key={seg.key}>
                  <div className="section-label mb-1.5">{seg.label}</div>
                  <div className="flex gap-1 bg-panel-inset rounded-lg p-1">
                    {seg.opts.map(([val, label]) => (
                      <button key={val} onClick={() => setInstr(instrFor, seg.key, val)}
                        className={cn("flex-1 py-1.5 rounded text-[11px] font-semibold transition-colors",
                          cur === val ? "bg-emerald text-emerald-ink" : "text-text-muted hover:text-text-cm")}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-text-faint mt-3">Değişiklikler otomatik kaydedilir.</p>
        </div>
      </div>
    )}
    </>
  );
}
