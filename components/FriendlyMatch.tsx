"use client";

import { useState } from "react";

// Maç reytingi (0-10) renk eşiği
function matchRatingColor(v: number): string {
  if (v < 5.5) return "#EF4444";
  if (v < 7) return "#F59E0B";
  return "#10B981";
}

interface FriendlyResult {
  home: { name: string; score: number };
  away: { name: string; score: number };
  motm: { playerId: string; name: string; team: "home" | "away" } | null;
  ratings: { playerId: string; name: string; rating: number }[];
}

const DIFFS = [
  { key: "easy", label: "Kolay" },
  { key: "medium", label: "Orta" },
  { key: "hard", label: "Zor" },
];

export default function FriendlyMatch({ canPlay }: { canPlay: boolean }) {
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<FriendlyResult | null>(null);

  async function play() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/friendly/play", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Maç oynanamadı.");
      setResult(d);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  if (!canPlay) {
    return (
      <div className="bg-panel border border-border-cm rounded-card p-6 text-center">
        <p className="text-sm text-text-muted">Lig başladığı için hazırlık maçları kapandı. Hazırlık maçları yalnızca lig öncesi oynanabilir.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-panel border border-border-cm rounded-card p-5">
        <div className="section-label mb-2">Rakip Zorluğu</div>
        <div className="flex gap-2 mb-4">
          {DIFFS.map((d) => (
            <button key={d.key} onClick={() => setDifficulty(d.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                difficulty === d.key ? "bg-emerald text-emerald-ink border-emerald" : "border-border-cm text-text-muted hover:border-emerald"
              }`}>
              {d.label}
            </button>
          ))}
        </div>
        <button onClick={play} disabled={loading}
          className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright disabled:opacity-50">
          {loading ? "Maç oynanıyor…" : "Hazırlık Maçı Oyna"}
        </button>
        <p className="text-[11px] text-text-faint text-center mt-2">Hazırlık maçları reytingleri, parayı veya puan tablosunu etkilemez.</p>
        {err && <p className="text-xs text-danger text-center mt-2">{err}</p>}
      </div>

      {result && (
        <div className="bg-panel border border-border-cm rounded-card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-5 border-b border-border-cm">
            <div className="text-right font-display font-bold text-lg truncate">{result.home.name}</div>
            <div className="font-display font-extrabold text-3xl tabular-nums px-3">
              {result.home.score} <span className="text-text-faint">-</span> {result.away.score}
            </div>
            <div className="text-left font-display font-bold text-lg text-text-muted truncate">{result.away.name}</div>
          </div>

          {result.motm && (
            <div className="px-6 py-2.5 border-b border-border-soft text-center text-xs">
              <span className="text-text-faint">Maçın Adamı: </span>
              <span className="font-semibold text-amber">{result.motm.name}</span>
            </div>
          )}

          <div className="p-4">
            <div className="section-label mb-2">Oyuncu Reytingleri (kendi takımın)</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {result.ratings.map((r) => (
                <div key={r.playerId} className="flex items-center justify-between text-sm py-0.5">
                  <span className="truncate text-text-2">{r.name}</span>
                  <span className="font-display font-bold tabular-nums ml-2" style={{ color: matchRatingColor(r.rating) }}>
                    {r.rating.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
