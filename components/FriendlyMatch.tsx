"use client";

import { useState } from "react";
import LiveMatchEngineCanvas from "./LiveMatchEngineCanvas";
import { generatePlayer } from "@/lib/player-generator";
import type { EngineTeam, SimResult } from "@/lib/match-engine/simulator";
import type { Player, Tactics, Position } from "@/types/game";

function matchRatingColor(v: number): string {
  if (v < 5.5) return "#EF4444";
  if (v < 7) return "#F59E0B";
  return "#10B981";
}

const DIFFS = [
  { key: "easy", label: "Kolay", range: [7, 11] as [number, number] },
  { key: "medium", label: "Orta", range: [9, 13] as [number, number] },
  { key: "hard", label: "Zor", range: [12, 16] as [number, number] },
];

function buildOpponent(name: string, range: [number, number]): EngineTeam {
  const plan: Position[] = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW", "DF", "MF", "FW"];
  const players: Player[] = plan.map((position, i) => {
    const g = generatePlayer({ position, attrMin: range[0], attrMax: range[1] });
    return {
      id: `opp-${i}`, team_id: "opp", name: `Rakip ${i + 1}`, age: g.age, position,
      is_youth_academy: false, potential: g.potential, value_cr: g.value_cr,
      for_sale: false, asking_price: null, created_at: "", ...g.attributes,
    } as unknown as Player;
  });
  return { teamId: "opp", name, isAi: true, players, tactics: null };
}

export default function FriendlyMatch({
  canPlay = true, players, tactics, teamName, homeColor,
}: {
  canPlay?: boolean;
  players: Player[];
  tactics: Tactics | null;
  teamName: string;
  homeColor: number;
}) {
  const [difficulty, setDifficulty] = useState("medium");
  const [match, setMatch] = useState<{ home: EngineTeam; away: EngineTeam; seed: string } | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);

  function play() {
    const d = DIFFS.find((x) => x.key === difficulty)!;
    const away = buildOpponent(`${d.label} Rakip`, d.range);
    const home: EngineTeam = { teamId: "home", name: teamName, isAi: false, players, tactics };
    setResult(null);
    setMatch({ home, away, seed: `fr-${difficulty}-${Math.floor(Math.random() * 1e9)}` });
  }

  if (!canPlay) {
    return (
      <div className="bg-panel border border-border-cm rounded-card p-6 text-center">
        <p className="text-sm text-text-muted">Hazırlık maçı için en az 11 oyuncun olmalı.</p>
      </div>
    );
  }

  if (match) {
    const homeRatings = (result?.playerRatings ?? []).filter((r) => r.team === "home");
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="text-right font-display font-bold text-lg truncate">{match.home.name}</div>
          <div className="text-xs text-text-faint">vs</div>
          <div className="text-left font-display font-bold text-lg text-text-muted truncate">{match.away.name}</div>
        </div>

        <LiveMatchEngineCanvas
          home={match.home} away={match.away}
          homeColor={homeColor} awayColor={0xef4444}
          seed={match.seed} onFinish={setResult}
        />

        <button onClick={() => { setMatch(null); setResult(null); }}
          className="w-full border border-border-cm py-2.5 rounded-lg text-sm hover:bg-panel-inset">
          Yeni Hazırlık Maçı
        </button>

        {result && result.manOfTheMatch && (
          <div className="bg-panel border border-border-cm rounded-card px-6 py-2.5 text-center text-xs">
            <span className="text-text-faint">Maçın Adamı: </span>
            <span className="font-semibold text-amber">{result.manOfTheMatch.name}</span>
          </div>
        )}
        {result && (
          <div className="bg-panel border border-border-cm rounded-card p-4">
            <div className="section-label mb-2">Oyuncu Reytingleri (kendi takımın)</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {homeRatings.map((r) => (
                <div key={r.playerId} className="flex items-center justify-between text-sm py-0.5">
                  <span className="truncate text-text-2">{r.name}</span>
                  <span className="font-display font-bold tabular-nums ml-2" style={{ color: matchRatingColor(r.rating) }}>{r.rating.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
        <button onClick={play}
          className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright">
          Hazırlık Maçı Oyna (Canlı)
        </button>
        <p className="text-[11px] text-text-faint text-center mt-2">Gerçek motorla 10 dk canlı maç. Reytingi, parayı veya puanı etkilemez.</p>
      </div>
    </div>
  );
}
