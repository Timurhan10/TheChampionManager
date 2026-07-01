"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRAINING_TYPES, FACILITY_COSTS, FACILITY_LABELS, FACILITY_MAX_LEVEL, facilityCoef, type TrainingKind } from "@/lib/training";
import { POSITION_COLORS } from "@/lib/attributes";
import { cn, formatCR } from "@/lib/utils";

type P = { id: string; name: string; position: string; age: number; potential: number | null };
type Gain = { key: string; label: string; amount: number; newValue: number; levelUp: boolean };

function stars(potential: number | null): number {
  return potential == null ? 0 : Math.max(1, Math.min(5, Math.round(potential / 4)));
}

export default function TrainingClient({
  players, trainedToday, remaining, facilityLevel, credits,
}: {
  players: P[];
  trainedToday: string[];
  remaining: number;
  facilityLevel: number;
  credits: number;
}) {
  const router = useRouter();
  const [done, setDone] = useState<string[]>(trainedToday);
  const [left, setLeft] = useState(remaining);
  const [sel, setSel] = useState<P | null>(null);
  const [kind, setKind] = useState<TrainingKind>("technical");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{ player: string; gains: Gain[]; failed: boolean; valueBefore?: number; valueAfter?: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [level, setLevel] = useState(facilityLevel);
  const [cr, setCr] = useState(credits);
  const [upgrading, setUpgrading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);

  const nextCost = level < FACILITY_MAX_LEVEL ? FACILITY_COSTS[level + 1] : null;

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
      setReport({ player: sel.name, gains: d.gains, failed: d.failed, valueBefore: d.valueBefore, valueAfter: d.valueAfter });
      setDone((x) => [...x, sel.id]);
      setLeft(d.remaining);
      setSel(null);
      router.refresh();
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  async function upgrade() {
    if (!nextCost) return;
    setUpgrading(true); setUpErr(null);
    try {
      const res = await fetch("/api/training/upgrade-facility", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setLevel(d.level);
      setCr((c) => c - d.cost);
      router.refresh();
    } catch (e: any) { setUpErr(e.message); } finally { setUpgrading(false); }
  }

  return (
    <div className="max-w-4xl grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">
      {/* Oyuncular */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="section-label">Oyuncular</span>
          <span className="text-xs text-text-faint">Tesis: {FACILITY_LABELS[level] ?? "Normal"}</span>
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

        {/* Tesis yükseltme — kalıcı gelişim yatırımı */}
        <div className="bg-panel border border-border-cm rounded-card p-4">
          <div className="section-label mb-1">Antrenman Tesisi</div>
          <div className="font-display font-extrabold text-lg">{FACILITY_LABELS[level]}</div>
          <p className="text-[11px] text-text-faint mt-0.5">Gelişim çarpanı: ×{facilityCoef(level).toFixed(2)}</p>
          {nextCost ? (
            <>
              <p className="text-[11px] text-text-muted mt-2">
                Sonraki: <b className="text-text-2">{FACILITY_LABELS[level + 1]}</b> — çarpan ×{facilityCoef(level + 1).toFixed(2)}
              </p>
              <button onClick={upgrade} disabled={upgrading || cr < nextCost}
                className="w-full mt-2 border border-emerald text-emerald text-sm font-semibold py-2 rounded-lg hover:bg-emerald/10 disabled:opacity-50 disabled:hover:bg-transparent">
                {upgrading ? "Yükseltiliyor…" : `Yükselt · ${formatCR(nextCost)}`}
              </button>
              {cr < nextCost && <p className="text-[11px] text-amber mt-1.5">Yetersiz CR ({formatCR(cr)} var).</p>}
              {upErr && <p className="text-xs text-danger mt-1.5">{upErr}</p>}
            </>
          ) : (
            <p className="text-[11px] text-emerald mt-2">En üst seviye ✓</p>
          )}
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
            {report.valueAfter != null && report.valueBefore != null && report.valueAfter !== report.valueBefore && (
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-border-soft">
                <span className="text-text-2">Piyasa değeri</span>
                <span className="tabular-nums">
                  <span className="text-text-faint">{formatCR(report.valueBefore)}</span>
                  <span className="text-emerald font-semibold ml-1">→ {formatCR(report.valueAfter)}</span>
                </span>
              </div>
            )}
            <p className="text-[11px] text-text-faint mt-2">Küçük artışlar birikir; dolunca özellik +1 olur.</p>
          </div>
        )}
      </div>
    </div>
  );
}
