"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { overallRating } from "@/lib/player-generator";
import { POSITION_COLORS, ratingColor } from "@/lib/attributes";
import type { Player, Tactics, PlayerInstruction, TacticStyle, TacticAdvanced } from "@/types/game";
import { FORMATIONS, shortName } from "@/lib/formations";
import { STYLE_PRESETS, ALL_STYLES } from "@/lib/tactic-styles";
import SquadFitPanel from "./SquadFitPanel";
import { useLineupEditor, LineupPitch } from "./LineupPitch";
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

const ADV_SEGMENTS = {
  width: { label: "Genişlik", options: [["narrow", "Dar"], ["normal", "Normal"], ["wide", "Geniş"]] },
  defensive_line: { label: "Savunma Hattı", options: [["low", "Alçak"], ["medium", "Orta"], ["high", "Yüksek"]] },
} as const;

export default function TacticsBoard({ players, initial }: { players: Player[]; initial: Tactics | null }) {
  const [formation, setFormation] = useState(initial?.formation ?? "4-4-2");
  const [mentality, setMentality] = useState(initial?.mentality ?? "balanced");
  const [pressing, setPressing] = useState(initial?.pressing ?? "medium");
  const [tempo, setTempo] = useState(initial?.tempo ?? "normal");
  const [passStyle, setPassStyle] = useState(initial?.pass_style ?? "mixed");
  const [style, setStyle] = useState<TacticStyle | null>(initial?.style ?? null);
  const [advanced, setAdvanced] = useState<TacticAdvanced>(initial?.advanced ?? {});
  const [lineup, setLineup] = useState<Record<string, string>>(initial?.lineup ?? {});
  const [subs, setSubs] = useState<string[]>(initial?.substitutes ?? []);
  const [instructions, setInstructions] = useState<Record<string, PlayerInstruction>>(initial?.player_instructions ?? {});
  const [instrFor, setInstrFor] = useState<string | null>(null); // talimat modalı açık oyuncu
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [pitchSize, setPitchSize] = useState<"sm" | "md">("sm");

  const slots = FORMATIONS[formation];
  // Ortak diziliş mantığı (FirstElevenEditor ile aynı çekirdek — LineupPitch.tsx)
  const { byId, usedIds, benchPlayers, onDragStart, onDragEndCleanup, onDropSlot, onDropBench, autoFill } =
    useLineupEditor({ players, lineup, setLineup });

  // Taktiği kaydet (hem otomatik hem manuel buton kullanır)
  async function saveTactics(): Promise<boolean> {
    setSaveState("saving");
    try {
      const res = await fetch("/api/tactics/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formation, mentality, pressing, tempo, pass_style: passStyle, style, advanced, lineup, substitutes: subs, player_instructions: instructions }),
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
  }, [formation, mentality, pressing, tempo, passStyle, style, advanced, lineup, subs, instructions]);

  // Stil seç: preset ayarlarını uygula (kullanıcı sonra tek tek değiştirebilir)
  function applyStyle(s: TacticStyle) {
    const preset = STYLE_PRESETS[s].settings;
    setStyle(s);
    setMentality(preset.mentality);
    setPressing(preset.pressing);
    setTempo(preset.tempo);
    setPassStyle(preset.pass_style);
    setAdvanced({
      width: preset.width,
      defensive_line: preset.defensive_line,
      time_wasting: preset.time_wasting ?? false,
      counter_attack: preset.counter_attack ?? false,
    });
  }

  // Uyum paneli için mevcut taktik nesnesi
  const currentTactics = useMemo(() => ({
    ...(initial ?? {}),
    formation, mentality, pressing, tempo, pass_style: passStyle,
    style, advanced, lineup, substitutes: subs, player_instructions: instructions,
  }) as Tactics, [initial, formation, mentality, pressing, tempo, passStyle, style, advanced, lineup, subs, instructions]);

  function setInstr(pid: string, key: keyof PlayerInstruction, val: string) {
    setInstructions((prev) => ({ ...prev, [pid]: { ...INSTR_DEFAULT, ...prev[pid], [key]: val } }));
  }

  const pitchW = pitchSize === "sm" ? "max-w-[360px]" : "max-w-[460px]";

  const instrPlayer = instrFor ? byId.get(instrFor) : undefined;

  return (
    <>
    {/* Oyun stili + taktik uyumu (Motor v2) */}
    <div className="mb-4 space-y-3">
      <div>
        <div className="section-label mb-1.5">Oyun Stili</div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_STYLES.map((s) => (
            <button key={s} onClick={() => applyStyle(s)} title={STYLE_PRESETS[s].desc}
              className={cn("px-3 py-2 rounded-lg text-sm font-semibold border transition-colors",
                style === s ? "bg-emerald/15 border-emerald text-emerald" : "bg-panel-inset border-border-cm text-text-muted hover:text-text-cm")}>
              {STYLE_PRESETS[s].label}
            </button>
          ))}
        </div>
        {style && <p className="text-[11px] text-text-faint mt-1">{STYLE_PRESETS[style].desc} Stil ayarları uygular; altta tek tek değiştirebilirsin.</p>}
      </div>
      <SquadFitPanel players={players} tactics={currentTactics} />
    </div>

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
        <button onClick={() => autoFill(slots)} className="w-full mt-3 py-2 rounded-lg text-xs font-semibold bg-blue-cm/15 border border-blue-cm text-blue-cm-bright hover:bg-blue-cm/25">
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

        <LineupPitch
          formation={formation}
          lineup={lineup}
          byId={byId}
          className={pitchW}
          slotSize="sm"
          onDragStart={onDragStart}
          onDragEndCleanup={onDragEndCleanup}
          onDropSlot={onDropSlot}
          onDropBench={onDropBench}
          renderUnderSlot={(player, slot) =>
            player ? (
              <div className="flex items-center gap-0.5">
                <Link href={`/player/${player.id}`} draggable={false} className="text-[9px] text-white/90 bg-black/40 rounded px-1 hover:text-emerald max-w-[64px] truncate">
                  {shortName(player.name)}
                </Link>
                <button onClick={() => setInstrFor(player.id)} title="Talimatlar"
                  className="text-[10px] bg-black/40 rounded px-1 text-white/80 hover:text-emerald">⚙</button>
              </div>
            ) : (
              <span className="text-[9px] text-white/40">{slot.role}</span>
            )
          }
        />
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

        {(Object.keys(ADV_SEGMENTS) as (keyof typeof ADV_SEGMENTS)[]).map((key) => {
          const conf = ADV_SEGMENTS[key];
          const value = (advanced[key] as string) ?? (key === "width" ? "normal" : "medium");
          return (
            <div key={key}>
              <div className="section-label mb-1.5">{conf.label}</div>
              <div className="flex gap-1 bg-panel-inset rounded-lg p-1">
                {conf.options.map(([val, label]) => (
                  <button key={val} onClick={() => setAdvanced((prev) => ({ ...prev, [key]: val as any }))}
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
                <span className="font-display font-bold" style={{ color: ratingColor(overallRating(p, p.position)) }}>{overallRating(p, p.position)}</span>
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
