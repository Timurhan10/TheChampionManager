"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { overallRating } from "@/lib/player-generator";
import { POSITION_COLORS, ratingColor, keyAttrs, ATTR_LABELS } from "@/lib/attributes";
import { FORMATIONS, shortName } from "@/lib/formations";
import { useLineupEditor, LineupPitch } from "./LineupPitch";
import type { Player, Tactics, LineupPreset } from "@/types/game";
import { cn, potentialStars } from "@/lib/utils";

type Selected = { type: "slot"; idx: number } | { type: "bench"; id: string } | null;

// Mobil öncelikli, SADECE ilk 11 düzenleme: dokun-yerleştir + (masaüstü) sürükle.
// Formasyon/mentalite gibi ayrıntılar yok — o Taktik sayfasında. 3 isimli kayıt slotu.
export default function FirstElevenEditor({ players, initial }: { players: Player[]; initial: Tactics | null }) {
  const [formation, setFormation] = useState(initial?.formation ?? "4-4-2");
  const [lineup, setLineup] = useState<Record<string, string>>(initial?.lineup ?? {});
  const [subs, setSubs] = useState<string[]>(initial?.substitutes ?? []);
  const [presets, setPresets] = useState<LineupPreset[]>(initial?.presets ?? []);
  const [selected, setSelected] = useState<Selected>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const [namingOpen, setNamingOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null); // Sahadaki 11 listesinde açık özellik satırı

  // Taşınan taktik alanları (İlk 11 ekranı değiştirmez ama kayıt/aktifleştirmede korunur)
  const carry = useRef({
    mentality: initial?.mentality ?? "balanced",
    pressing: initial?.pressing ?? "medium",
    tempo: initial?.tempo ?? "normal",
    pass_style: initial?.pass_style ?? "mixed",
    player_instructions: initial?.player_instructions ?? {},
  });

  const slots = FORMATIONS[formation];
  // Ortak diziliş mantığı (TacticsBoard ile aynı çekirdek — LineupPitch.tsx)
  const { byId, usedIds, benchPlayers, placeInSlot, swapSlots, onDragStart, onDragEndCleanup, onDropSlot, onDropBench, autoFill } =
    useLineupEditor({ players, lineup, setLineup, onPlace: (id) => setSubs((prev) => prev.filter((x) => x !== id)) });

  // --- Dokun-yerleştir (mobil dostu) ---
  function tapSlot(idx: number) {
    if (!selected) { setSelected({ type: "slot", idx }); return; }
    if (selected.type === "slot") {
      if (selected.idx === idx) setSelected(null);
      else { swapSlots(selected.idx, idx); setSelected(null); }
    } else {
      placeInSlot(idx, selected.id); setSelected(null);
    }
  }
  function tapBench(id: string) {
    if (selected?.type === "slot") { placeInSlot(selected.idx, id); setSelected(null); }
    else if (selected?.type === "bench" && selected.id === id) setSelected(null);
    else setSelected({ type: "bench", id });
  }

  // --- Kaydet / kullan ---
  async function saveActive() {
    setSaveState("saving"); setErr(null);
    try {
      const res = await fetch("/api/tactics/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formation, ...carry.current, lineup, substitutes: subs }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Kaydedilemedi.");
      setSaveState("saved"); setLoadedName(null);
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e: any) { setErr(e.message); setSaveState("idle"); }
  }

  async function savePreset(index?: number) {
    const name = nameInput.trim() || `Kayıt ${presets.length + 1}`;
    setErr(null);
    try {
      const preset: LineupPreset = {
        name, formation, ...carry.current, lineup, substitutes: subs,
      };
      const res = await fetch("/api/tactics/presets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", name, index, preset }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Kayıt başarısız.");
      setPresets(d.presets);
      setNamingOpen(false); setNameInput("");
    } catch (e: any) { setErr(e.message); }
  }
  async function deletePreset(index: number) {
    setErr(null);
    try {
      const res = await fetch("/api/tactics/presets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", index }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Silinemedi.");
      setPresets(d.presets);
    } catch (e: any) { setErr(e.message); }
  }
  function loadPreset(p: LineupPreset) {
    setFormation(p.formation);
    setLineup(p.lineup ?? {});
    setSubs(p.substitutes ?? []);
    carry.current = {
      mentality: p.mentality, pressing: p.pressing, tempo: p.tempo,
      pass_style: p.pass_style, player_instructions: p.player_instructions ?? {},
    };
    setSelected(null);
    setLoadedName(p.name);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Diziliş seçimi (yatay kaydırılabilir) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {Object.keys(FORMATIONS).map((f) => (
          <button key={f} onClick={() => setFormation(f)}
            className={cn("shrink-0 px-3 py-2 rounded-lg text-sm font-display font-bold border",
              formation === f ? "bg-emerald/15 border-emerald text-emerald" : "bg-panel-inset border-border-cm text-text-muted")}>
            {f}
          </button>
        ))}
        <button onClick={() => autoFill(slots)} className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-cm/15 border border-blue-cm text-blue-cm-bright">
          Otomatik Diz
        </button>
      </div>

      {loadedName && (
        <div className="bg-blue-cm/10 border border-blue-cm/40 rounded-lg px-3 py-2 text-sm text-blue-cm-bright">
          <b>{loadedName}</b> yüklendi. Kullanmak için <b>“Aktif Olarak Kaydet”</b>e bas.
        </div>
      )}

      {/* Saha (ortak bileşen) */}
      <div className="w-full max-w-[420px] mx-auto">
        <LineupPitch
          formation={formation}
          lineup={lineup}
          byId={byId}
          slotSize="md"
          selectedIdx={selected?.type === "slot" ? selected.idx : null}
          onSlotClick={tapSlot}
          onDragStart={onDragStart}
          onDragEndCleanup={onDragEndCleanup}
          onDropSlot={onDropSlot}
          onDropBench={onDropBench}
          renderUnderSlot={(player, slot) =>
            player ? (
              <span className="text-[9px] text-white/90 bg-black/40 rounded px-1 max-w-[72px] truncate">{shortName(player.name)}</span>
            ) : (
              <span className="text-[9px] text-white/40">{slot.role}</span>
            )
          }
        />
        <div className="mt-2 text-[11px] text-text-faint text-center">
          Seçili: {usedIds.size}/11 · <b>Dokun</b>: oyuncuyu/slotu seç, sonra hedefe dokun (yer değiştir). Masaüstünde <b>sürükle</b> de olur.
        </div>
      </div>

      {/* Sahadaki 11 — oyuncular + özellikleri (satıra dokun → pozisyona göre önemli özellikler) */}
      <div>
        <div className="section-label mb-1.5">Sahadaki 11 ({usedIds.size}/11)</div>
        <div className="bg-panel border border-border-cm rounded-card divide-y divide-border-soft overflow-hidden">
          {slots.map((slot, i) => {
            const pid = lineup[String(i)];
            const player = pid ? byId.get(pid) : undefined;
            const color = POSITION_COLORS[slot.role];
            if (!player) {
              return (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-faint">
                  <span className="w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: color.bg, color: color.color }}>{slot.role}</span>
                  Boş slot — sahadan veya yedeklerden oyuncu seç
                </div>
              );
            }
            const rating = overallRating(player, player.position);
            const st = potentialStars(player.potential ?? null);
            const expanded = detailId === player.id;
            return (
              <div key={i}>
                <button onClick={() => setDetailId(expanded ? null : player.id)}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-left", expanded ? "bg-panel-inset/60" : "hover:bg-panel-inset/40")}>
                  <span className="w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: POSITION_COLORS[player.position].bg, color: POSITION_COLORS[player.position].color }}>{player.position}</span>
                  <span className="text-sm truncate flex-1">{player.name}</span>
                  <span className="text-[11px] text-text-faint shrink-0">{player.age}y</span>
                  <span className="text-amber text-xs tracking-tight shrink-0">{"★".repeat(st)}<span className="text-text-faint">{"★".repeat(5 - st)}</span></span>
                  <span className="font-display font-extrabold text-[15px] w-7 text-center shrink-0" style={{ color: ratingColor(rating) }}>{rating}</span>
                  <span className={cn("text-text-faint transition-transform shrink-0", expanded && "rotate-180")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </span>
                </button>
                {expanded && (
                  <div className="px-3 pb-2.5 pt-1 grid grid-cols-2 gap-x-5 gap-y-1 bg-panel-inset/30">
                    {keyAttrs(player.position).map((k) => {
                      const v = (player as any)[k];
                      return (
                        <div key={k} className="flex items-center justify-between text-[12px]">
                          <span className="text-text-muted">{ATTR_LABELS[k]}</span>
                          <span className="font-bold tabular-nums" style={{ color: typeof v === "number" ? ratingColor(v) : undefined }}>{typeof v === "number" ? v : "—"}</span>
                        </div>
                      );
                    })}
                    <Link href={`/player/${player.id}`} className="col-span-2 text-center text-[11px] text-text-faint hover:text-emerald mt-1">
                      Tüm profil →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sahadaki 11 — oyuncular + özellikleri (satıra dokun → pozisyona göre önemli özellikler) */}
      <div>
        <div className="section-label mb-1.5">Sahadaki 11 ({usedIds.size}/11)</div>
        <div className="bg-panel border border-border-cm rounded-card divide-y divide-border-soft overflow-hidden">
          {slots.map((slot, i) => {
            const pid = lineup[String(i)];
            const player = pid ? byId.get(pid) : undefined;
            const color = POSITION_COLORS[slot.role];
            if (!player) {
              return (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-faint">
                  <span className="w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: color.bg, color: color.color }}>{slot.role}</span>
                  Boş slot — sahadan veya yedeklerden oyuncu seç
                </div>
              );
            }
            const rating = overallRating(player, player.position);
            const st = potentialStars(player.potential ?? null);
            const expanded = detailId === player.id;
            return (
              <div key={i}>
                <button onClick={() => setDetailId(expanded ? null : player.id)}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-left", expanded ? "bg-panel-inset/60" : "hover:bg-panel-inset/40")}>
                  <span className="w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: POSITION_COLORS[player.position].bg, color: POSITION_COLORS[player.position].color }}>{player.position}</span>
                  <span className="text-sm truncate flex-1">{player.name}</span>
                  <span className="text-[11px] text-text-faint shrink-0">{player.age}y</span>
                  <span className="text-amber text-xs tracking-tight shrink-0">{"★".repeat(st)}<span className="text-text-faint">{"★".repeat(5 - st)}</span></span>
                  <span className="font-display font-extrabold text-[15px] w-7 text-center shrink-0" style={{ color: ratingColor(rating) }}>{rating}</span>
                  <span className={cn("text-text-faint transition-transform shrink-0", expanded && "rotate-180")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </span>
                </button>
                {expanded && (
                  <div className="px-3 pb-2.5 pt-1 grid grid-cols-2 gap-x-5 gap-y-1 bg-panel-inset/30">
                    {keyAttrs(player.position).map((k) => {
                      const v = (player as any)[k];
                      return (
                        <div key={k} className="flex items-center justify-between text-[12px]">
                          <span className="text-text-muted">{ATTR_LABELS[k]}</span>
                          <span className="font-bold tabular-nums" style={{ color: typeof v === "number" ? ratingColor(v) : undefined }}>{typeof v === "number" ? v : "—"}</span>
                        </div>
                      );
                    })}
                    <Link href={`/player/${player.id}`} className="col-span-2 text-center text-[11px] text-text-faint hover:text-emerald mt-1">
                      Tüm profil →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Yedekler */}
      <div onDragOver={(e) => e.preventDefault()} onDrop={onDropBench}>
        <div className="section-label mb-1.5">Yedek Kulübesi ({benchPlayers.length})</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {benchPlayers.map((p) => {
            const isSel = selected?.type === "bench" && selected.id === p.id;
            return (
              <button key={p.id} draggable onClick={() => tapBench(p.id)}
                onDragStart={(e) => onDragStart(e, { playerId: p.id, from: "bench" }, p)} onDragEnd={onDragEndCleanup}
                className={cn("flex items-center justify-between px-2 py-2 rounded text-[12px] bg-panel-inset border text-left active:scale-95 transition-transform",
                  isSel ? "border-emerald ring-1 ring-emerald" : "border-transparent hover:border-border-cm")}>
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center shrink-0" style={{ background: POSITION_COLORS[p.position].bg, color: POSITION_COLORS[p.position].color }}>{p.position}</span>
                  <span className="truncate">{shortName(p.name)}</span>
                </span>
                <span className="font-display font-bold shrink-0 ml-1" style={{ color: ratingColor(overallRating(p, p.position)) }}>{overallRating(p, p.position)}</span>
              </button>
            );
          })}
          {benchPlayers.length === 0 && <div className="col-span-full text-center text-text-muted text-sm py-3">Tüm oyuncular sahada.</div>}
        </div>
      </div>

      {/* Aktif kaydet */}
      <button onClick={saveActive} disabled={saveState === "saving"}
        className="w-full py-3 rounded-lg text-sm font-semibold bg-emerald text-emerald-ink hover:bg-emerald-bright disabled:opacity-60">
        {saveState === "saving" ? "Kaydediliyor…" : saveState === "saved" ? "✓ Kaydedildi" : "Aktif Olarak Kaydet"}
      </button>

      {/* Kayıt slotları */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="section-label">Kayıtlı 11'lerim ({presets.length}/3)</span>
          {presets.length < 3 && !namingOpen && (
            <button onClick={() => { setNamingOpen(true); setNameInput(""); }}
              className="text-xs font-semibold px-2.5 py-1 rounded border border-border-cm hover:bg-panel-inset hover:text-emerald">
              + Bu 11'i Kaydet
            </button>
          )}
        </div>

        {namingOpen && (
          <div className="flex gap-2 mb-2">
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} maxLength={40}
              placeholder="Kayıt adı (ör. Deplasman 4-5-1)"
              className="flex-1 bg-panel-inset border border-border-cm rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald" />
            <button onClick={() => savePreset()} className="px-3 py-2 rounded-lg text-sm font-semibold bg-emerald text-emerald-ink">Kaydet</button>
            <button onClick={() => setNamingOpen(false)} className="px-3 py-2 rounded-lg text-sm border border-border-cm">İptal</button>
          </div>
        )}

        <div className="space-y-1.5">
          {presets.length === 0 && <div className="text-text-muted text-sm text-center py-3 bg-panel border border-border-cm rounded-card">Henüz kayıt yok. Bir 11 hazırlayıp “Bu 11'i Kaydet” de.</div>}
          {presets.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-2 bg-panel border border-border-cm rounded-lg px-3 py-2">
              <span className="flex items-center gap-2 truncate">
                <span className="font-display font-bold text-sm truncate">{p.name}</span>
                <span className="text-[11px] text-text-faint shrink-0">{p.formation}</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => loadPreset(p)} className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-cm/15 text-blue-cm-bright border border-blue-cm/40 hover:bg-blue-cm/25">Yükle</button>
                <button onClick={() => deletePreset(i)} className="text-xs px-2 py-1 rounded border border-border-cm text-text-muted hover:text-danger hover:border-danger">Sil</button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {err && <p className="text-sm text-danger text-center">{err}</p>}

      <div className="text-center">
        <Link href="/tactics" className="text-xs text-text-faint hover:text-emerald">Gelişmiş taktik ayarları →</Link>
      </div>
    </div>
  );
}
