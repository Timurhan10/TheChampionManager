"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LiveMatchEngineCanvas from "./LiveMatchEngineCanvas";
import { generatePlayer } from "@/lib/player-generator";
import { computeSquadFit, resolveStyle } from "@/lib/match-engine/fit";
import { STYLE_PRESETS } from "@/lib/tactic-styles";
import type { EngineTeam, SimResult } from "@/lib/match-engine/simulator";
import type { Player, Tactics, Position } from "@/types/game";
import { cn } from "@/lib/utils";

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
  canPlay = true, players, tactics, teamName, homeColor, leagueOpponents = [],
}: {
  canPlay?: boolean;
  players: Player[];
  tactics: Tactics | null;
  teamName: string;
  homeColor: number;
  leagueOpponents?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"ai" | "league">("ai");
  const [difficulty, setDifficulty] = useState("medium");
  const [leagueOppId, setLeagueOppId] = useState(leagueOpponents[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [match, setMatch] = useState<{ home: EngineTeam; away: EngineTeam; seed: string } | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);

  const myFit = computeSquadFit(players, tactics);
  const fitColor = myFit.score < 45 ? "#EF4444" : myFit.score < 70 ? "#F59E0B" : "#10B981";

  function playAi() {
    const d = DIFFS.find((x) => x.key === difficulty)!;
    const away = buildOpponent(`${d.label} Rakip`, d.range);
    start(away);
  }

  async function playLeague() {
    if (!leagueOppId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/friendly/opponent?teamId=${encodeURIComponent(leagueOppId)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Rakip yüklenemedi.");
      start(d.opponent as EngineTeam);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  function start(away: EngineTeam) {
    const home: EngineTeam = { teamId: "home", name: teamName, isAi: false, players, tactics };
    setResult(null);
    setMatch({ home, away, seed: `fr-${Math.floor(Math.random() * 1e9)}` });
  }

  async function onFinish(r: SimResult) {
    setResult(r);
    // Geçmişe kaydet (puan/para etkilenmez)
    try {
      await fetch("/api/friendly/record", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opponentName: match?.away.name, homeScore: r.homeScore, awayScore: r.awayScore,
          stats: r.stats, motm: r.manOfTheMatch,
          ratings: r.playerRatings.filter((x) => x.team === "home"),
        }),
      });
      router.refresh();
    } catch { /* kritik değil */ }
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
          seed={match.seed} mySide="home" onFinish={onFinish}
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
    <div className="space-y-4 max-w-2xl">
      <div className="bg-panel border border-border-cm rounded-card px-4 py-2.5 text-sm flex items-center justify-between">
        <span><span className="text-text-faint">Taktiğin: </span><span className="font-semibold">{STYLE_PRESETS[resolveStyle(tactics)].label}</span></span>
        <span><span className="text-text-faint">Uyum: </span><span className="font-display font-bold" style={{ color: fitColor }}>{myFit.score}/100</span></span>
      </div>

      <div className="bg-panel border border-border-cm rounded-card p-5">
        {/* Sekmeler */}
        <div className="flex gap-1 bg-panel-inset rounded-lg p-1 mb-4">
          <button onClick={() => setTab("ai")}
            className={cn("flex-1 py-2 rounded text-sm font-semibold", tab === "ai" ? "bg-emerald text-emerald-ink" : "text-text-muted hover:text-text-cm")}>
            AI Rakip
          </button>
          <button onClick={() => setTab("league")}
            className={cn("flex-1 py-2 rounded text-sm font-semibold", tab === "league" ? "bg-emerald text-emerald-ink" : "text-text-muted hover:text-text-cm")}>
            Lig Takımı
          </button>
        </div>

        {tab === "ai" ? (
          <>
            <div className="section-label mb-2">Rakip Zorluğu</div>
            <div className="flex gap-2 mb-4">
              {DIFFS.map((d) => (
                <button key={d.key} onClick={() => setDifficulty(d.key)}
                  className={cn("flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                    difficulty === d.key ? "bg-emerald text-emerald-ink border-emerald" : "border-border-cm text-text-muted hover:border-emerald")}>
                  {d.label}
                </button>
              ))}
            </div>
            <button onClick={playAi}
              className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright">
              Hazırlık Maçı Oyna (Canlı)
            </button>
          </>
        ) : (
          <>
            <div className="section-label mb-2">Ligdeki Rakip</div>
            {leagueOpponents.length === 0 ? (
              <p className="text-sm text-text-muted mb-3">Bir lige katılınca rakip takımlara karşı hazırlık maçı oynayabilirsin.</p>
            ) : (
              <select value={leagueOppId} onChange={(e) => setLeagueOppId(e.target.value)}
                className="w-full bg-panel-inset border border-border-cm rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald mb-3">
                {leagueOpponents.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <button onClick={playLeague} disabled={loading || !leagueOppId}
              className="w-full bg-emerald text-emerald-ink font-semibold py-2.5 rounded-lg hover:bg-emerald-bright disabled:opacity-50">
              {loading ? "Rakip yükleniyor…" : "Lig Rakibine Karşı Oyna (Canlı)"}
            </button>
            <p className="text-[11px] text-text-faint text-center mt-2">Seviyeni ölçmek için ligdeki gerçek kadroya karşı oyna.</p>
          </>
        )}
        <p className="text-[11px] text-text-faint text-center mt-2">Hazırlık maçları reytingi, parayı veya puanı etkilemez.</p>
        {err && <p className="text-xs text-danger text-center mt-2">{err}</p>}
      </div>
    </div>
  );
}
