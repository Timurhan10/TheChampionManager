"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { overallRating } from "@/lib/player-generator";
import { POSITION_COLORS, ratingColor } from "@/lib/attributes";
import { FORMATIONS, shortName } from "@/lib/formations";
import type { Player, Tactics, LineupPreset } from "@/types/game";
import { cn } from "@/lib/utils";

interface DragItem { playerId: string; from: "bench" | number; }
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

  // Taşınan taktik alanları (İlk 11 ekranı değiştirmez ama kayıt/aktifleştirmede korunur)
  const carry = useRef({
    mentality: initial?.mentality ?? "balanced",
    pressing: initial?.pressing ?? "medium",
    tempo: initial?.tempo ?? "normal",
    pass_style: initial?.pass_style ?? "mixed",
    player_instructions: initial?.player_instructions ?? {},
  });

  const slots = FORMATIONS[formation];
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
    setSubs((prev) => prev.filter((id) => id !== playerId));
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

  // --- Sürükleme (masaüstü) — yuvarlak numara rozeti ---
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
    const item = dragRef.current; if (!item) return;
    if (typeof item.from === "number") {
      const from = item.from;
      setLineup((prev) => {
        const next = { ...prev };
        const target = next[String(slotIdx)];
        next[String(slotIdx)] = item.playerId;
        if (target) next[String(from)] = target; else delete next[String(from)];
        return next;
      });
    } else {
      placeInSlot(slotIdx, item.playerId);
    }
    dragRef.current = null;
  }
  function onDropBench() { const item = dragRef.current; if (item && typeof item.from === "number") removeFromLineup(item.playerId); dragRef.current = null; }

  function autoFill() {
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
        <button onClick={autoFill} className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-cm/15 border border-blue-cm text-blue-cm-bright">
          Otomatik Diz
        </button>
      </div>

      {loadedName && (
        <div className="bg-blue-cm/10 border border-blue-cm/40 rounded-lg px-3 py-2 text-sm text-blue-cm-bright">
          <b>{loadedName}</b> yüklendi. Kullanmak için <b>“Aktif Olarak Kaydet”</b>e bas.
        </div>
      )}

      {/* Saha */}
      <div className="w-full max-w-[420px] mx-auto">
        <div className="relative w-full aspect-[3/4] rounded-card overflow-hidden border border-border-cm"
          style={{ background: "repeating-linear-gradient(180deg, #0f3d2a 0px, #0f3d2a 36px, #0d3525 36px, #0d3525 72px)" }}
          onDragOver={(e) => e.preventDefault()} onDrop={onDropBench}>
          <div className="absolute inset-3 border-2 border-white/20 rounded" />
          <div className="absolute left-3 right-3 top-1/2 h-0.5 bg-white/20" />
          <div className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 border-2 border-white/20 rounded-full" />

          {slots.map((slot, i) => {
            const pid = lineup[String(i)];
            const player = pid ? byId.get(pid) : undefined;
            const color = POSITION_COLORS[slot.role];
            const isSel = selected?.type === "slot" && selected.idx === i;
            return (
              <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); onDropSlot(i); }}>
                <button
                  draggable={!!player}
                  onDragStart={(e) => player && onDragStart(e, { playerId: player.id, from: i }, player)}
                  onDragEnd={onDragEndCleanup}
                  onClick={() => tapSlot(i)}
                  className={cn("w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-transform active:scale-95",
                    isSel && "ring-2 ring-emerald ring-offset-1 ring-offset-[#0f3d2a] scale-110")}
                  style={{ background: "#0C1524", borderColor: color.color, color: player ? "#F1F5F9" : color.color }}
                  title={player ? `${player.name} · ${overallRating(player, player.position)}` : slot.role}>
                  {player ? (player.shirt_number ?? overallRating(player, player.position)) : slot.role}
                </button>
                {player ? (
                  <span className="text-[9px] text-white/90 bg-black/40 rounded px-1 max-w-[72px] truncate">{shortName(player.name)}</span>
                ) : (
                  <span className="text-[9px] text-white/40">{slot.role}</span>
                )}
              </div>
            );
          })}
          <div className="absolute bottom-2 left-2 text-xs font-display font-bold px-2 py-1 rounded bg-black/40">{formation}</div>
        </div>
        <div className="mt-2 text-[11px] text-text-faint text-center">
          Seçili: {usedIds.size}/11 · <b>Dokun</b>: oyuncuyu/slotu seç, sonra hedefe dokun (yer değiştir). Masaüstünde <b>sürükle</b> de olur.
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
