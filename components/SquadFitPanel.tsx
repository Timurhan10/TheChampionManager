"use client";

import { useMemo } from "react";
import { computeSquadFit } from "@/lib/match-engine/fit";
import { STYLE_PRESETS } from "@/lib/tactic-styles";
import type { Player, Tactics } from "@/types/game";

// Taktik-kadro uyum göstergesi: 0-100 puan + eksik/güçlü yön açıklamaları.
// Taktik ekranında her değişiklikte yeniden hesaplanır (saf, client-side).
export default function SquadFitPanel({ players, tactics }: { players: Player[]; tactics: Tactics }) {
  const fit = useMemo(() => computeSquadFit(players, tactics), [players, tactics]);
  const color = fit.score < 45 ? "#EF4444" : fit.score < 70 ? "#F59E0B" : "#10B981";

  return (
    <div className="bg-panel border border-border-cm rounded-card p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="section-label">Taktik Uyumu — {STYLE_PRESETS[fit.style].label}</span>
        <span className="font-display font-extrabold text-xl tabular-nums" style={{ color }}>{fit.score}/100</span>
      </div>
      <div className="h-2 rounded-full bg-panel-inset overflow-hidden mb-2.5">
        <div className="h-full rounded-full transition-all" style={{ width: `${fit.score}%`, background: color }} />
      </div>

      {fit.strengths.map((s, i) => (
        <p key={`s${i}`} className="text-xs text-emerald-bright flex gap-1.5 py-0.5"><span>✓</span><span>{s}</span></p>
      ))}
      {fit.gaps.map((g, i) => (
        <p key={`g${i}`} className={`text-xs flex gap-1.5 py-0.5 ${g.severity === "high" ? "text-danger" : "text-amber"}`}>
          <span>{g.severity === "high" ? "✖" : "⚠"}</span><span>{g.text}</span>
        </p>
      ))}
      {fit.gaps.length === 0 && fit.strengths.length === 0 && (
        <p className="text-xs text-text-muted">Kadron bu taktiğe makul uyuyor. Uyum arttıkça maçta avantaj kazanırsın.</p>
      )}
      <p className="text-[10px] text-text-faint mt-2">Uyumlu taktik maçta güç verir; uyumsuz taktik cezalandırır. Kadrona en uygun stili bul.</p>
    </div>
  );
}
