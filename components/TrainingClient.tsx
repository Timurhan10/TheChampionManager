"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRAINING_TYPES, type TrainingKind } from "@/lib/training";
import { POSITION_COLORS } from "@/lib/attributes";
import { cn } from "@/lib/utils";

type P = { id: string; name: string; position: string; age: number; potential: number | null };
type Gain = { key: string; label: string; amount: number; newValue: number; levelUp: boolean };

function stars(potential: number | null): number {
  return potential == null ? 0 : Math.max(1, Math.min(5, Math.round(potential / 4)));
}

const FACILITY_LABEL = ["", "Normal", "İyi", "Çok İyi", "Üst Düzey", "Elit"];

export default function TrainingClient({
  players, trainedToday, remaining, facilityLevel,
}: {
  players: P[];
  trainedToday: string[];
  remaining: number;
  facilityLevel: number;
}) {
  const router = useRouter();
  const [done, setDone] = useState<string[]>(trainedToday);
  const [left, setLeft] = useState(remaining);
  const [sel, setSel] = useState<P | null>(null);
  const [kind, setKind] = useState<TrainingKind>("technical");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{ player: string; gains: Gain[]; failed: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!sel) return;
    setLoading(true); setErr(null); setReport(null);
    try {
      const res = await fetch("/api/training/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: sel.id, kind }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setReport({ player: sel.name, gains: d.gains, failed: d.failed });
      setDone((x) => [...x, sel.id]);
      setLeft(d.remaining);
      setSel(null);
      router.refresh();
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="max-w-4xl grid grid-cols-[1fr_320px] gap-5">
      {/* Oyuncular */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="section-label">Oyuncular</span>
          <span className="text-xs text-text-faint">Tesis: {FACILITY_LABEL[facilityLevel] ?? "Normal"}</span>
        </div>
        <div className="bg-panel border border-border-cm rounded-card divide-y divide-border-soft max-h-[520px] overflow-y-auto">
          {players.map((p) => {
            const trained = done.includes(p.id);
            const st = stars(p.potential);
            return (
              <button key={p.id} disabled={trained} onClick={() => setSel(p)}
                className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left disabled:opacity-40",
                  sel?.id === p.id ? "bg-emerald/10" : "hover:bg-panel-inset/40")}>
                <span className="w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: POSITION_COLORS[p.position]?.bg, color: POSITION_COLORS[p.position]?.color }}>{p.position}</span>
                <span className="text-sm truncate flex-1">{p.name}</span>
                <span className="text-[11px] text-text-faint">{p.age}y</span>
                <span className="text-amber text-xs tracking-tight">{"★".repeat(st)}<span className="text-text-faint">{"★".repeat(5 - st)}</span></span>
                {trained && <span className="text-[10px] text-emerald">bugün ✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Antrenman paneli */}
      <div className="space-y-4">
        <div className="bg-panel border border-border-cm rounded-card p-4">
          <div className="section-label mb-1">Günlük Hak</div>
          <div className="font-display font-extrabold text-2xl">{left} / 3</div>
          <p className="text-[11px] text-text-faint mt-1">Her gün 3 antrenman, oyuncu başına 1.</p>
        </div>

        <div className="bg-panel border border-border-cm rounded-card p-4">
          <div className="section-label mb-2">Antrenman Türü</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(Object.keys(TRAINING_TYPES) as TrainingKind[]).map((k) => (
              <button key={k} onClick={() => setKind(k)}
                className={cn("py-2 rounded-lg text-sm font-semibold border", kind === k ? "bg-emerald text-emerald-ink border-emerald" : "border-border-cm text-text-muted hover:border-emerald")}>
                {TRAINING_TYPES[k].label}
              </button>
            ))}
          </div>
          <div className="text-xs text-text-muted mb-3">
            Seçili: <b className="text-text-2">{sel?.name ?? "oyuncu seç"}</b>
          </div>
          <button onClick={run} disabled={!sel || loading || left <= 0}
            className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright disabled:opacity-50">
            {loading ? "Çalıştırılıyor…" : left <= 0 ? "Hak kalmadı" : "Antrenmanı Uygula"}
          </button>
          {err && <p className="text-xs text-danger mt-2">{err}</p>}
        </div>

        {report && (
          <div className="bg-panel border border-border-cm rounded-card p-4">
            <div className="section-label mb-1">Rapor — {report.player}</div>
            {report.failed && <p className="text-[11px] text-amber mb-1">Oyuncu antrenmana zayıf tepki verdi.</p>}
            <div className="space-y-1">
              {report.gains.map((g) => (
                <div key={g.key} className="flex items-center justify-between text-sm">
                  <span className="text-text-2">{g.label}</span>
                  <span className="tabular-nums">
                    <span className="text-emerald font-semibold">+{g.amount.toFixed(2)}</span>
                    {g.levelUp && <span className="text-emerald-bright ml-2 font-bold">→ {g.newValue} ⬆</span>}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-text-faint mt-2">Küçük artışlar birikir; dolunca özellik +1 olur.</p>
          </div>
        )}
      </div>
    </div>
  );
}
