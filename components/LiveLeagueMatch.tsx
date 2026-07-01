"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LiveMatchEngineCanvas from "./LiveMatchEngineCanvas";
import { computeSquadFit, resolveStyle } from "@/lib/match-engine/fit";
import { STYLE_PRESETS } from "@/lib/tactic-styles";
import type { EngineTeam, SimResult } from "@/lib/match-engine/simulator";
import type { Side } from "@/lib/match-engine/live/engine";
import { teamBadge } from "@/lib/utils";

// Lig maçı — GERÇEK canlı motorla oynanır; sonuç sunucuya doğrulamalı kaydedilir.
export default function LiveLeagueMatch({
  matchId, home, away, homeColor, awayColor, scheduledAt, mySide,
}: {
  matchId: string;
  home: EngineTeam;
  away: EngineTeam;
  homeColor: number;
  awayColor: number;
  scheduledAt: string;
  mySide: Side;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const resultRef = useRef<SimResult | null>(null);

  const myTeam = mySide === "home" ? home : away;
  const oppTeam = mySide === "home" ? away : home;
  const myFit = useMemo(() => computeSquadFit(myTeam.players, myTeam.tactics), [myTeam]);
  const oppStyle = resolveStyle(oppTeam.tactics);

  async function submit(r: SimResult) {
    resultRef.current = r;
    setSaveState("saving");
    try {
      const res = await fetch("/api/matches/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, liveResult: r }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Kaydedilemedi.");
      setSaveState("saved");
      setTimeout(() => router.refresh(), 1200);
    } catch {
      setSaveState("error");
    }
  }

  if (started) {
    return (
      <div className="flex-1 overflow-y-auto p-[22px]">
        <div className="grid grid-cols-3 items-center mb-4">
          <div className="flex items-center gap-2 justify-end">
            <span className="font-display font-bold">{home.name}</span>
            <span className="w-8 h-8 rounded-lg bg-blue-cm/20 text-blue-cm-bright flex items-center justify-center text-xs font-bold">{teamBadge(home.name)}</span>
          </div>
          <div className="text-center text-xs text-text-faint">EV SAHİBİ — DEPLASMAN</div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-danger/20 text-danger flex items-center justify-center text-xs font-bold">{teamBadge(away.name)}</span>
            <span className="font-display font-bold">{away.name}</span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <LiveMatchEngineCanvas
            home={home} away={away}
            homeColor={homeColor} awayColor={awayColor}
            seed={matchId} mySide={mySide}
            onFinish={submit}
          />
          {saveState === "saving" && <p className="text-sm text-text-muted mt-2 text-center">Sonuç kaydediliyor…</p>}
          {saveState === "saved" && <p className="text-sm text-emerald-bright mt-2 text-center">✓ Sonuç kaydedildi — puan tablosu güncellendi.</p>}
          {saveState === "error" && (
            <div className="text-center mt-2">
              <p className="text-sm text-danger mb-1">Sonuç kaydedilemedi.</p>
              <button onClick={() => resultRef.current && submit(resultRef.current)}
                className="text-sm border border-border-cm px-4 py-1.5 rounded-lg hover:bg-panel-inset">Tekrar Dene</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Maç öncesi ekran: rakip stili + kendi uyumun
  const fitColor = myFit.score < 45 ? "#EF4444" : myFit.score < 70 ? "#F59E0B" : "#10B981";
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="section-label mb-2">Maç Başlamak Üzere</div>
      <div className="font-display font-bold text-2xl mb-1">{home.name} <span className="text-text-faint">vs</span> {away.name}</div>
      <div className="text-text-muted text-sm mb-5">{new Date(scheduledAt).toLocaleString("tr-TR")}</div>

      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <div className="bg-panel border border-border-cm rounded-card px-4 py-2.5 text-sm">
          <span className="text-text-faint">Rakip stili: </span>
          <span className="font-semibold text-text-2">{STYLE_PRESETS[oppStyle].label}</span>
        </div>
        <div className="bg-panel border border-border-cm rounded-card px-4 py-2.5 text-sm">
          <span className="text-text-faint">Taktik uyumun: </span>
          <span className="font-display font-bold" style={{ color: fitColor }}>{myFit.score}/100</span>
        </div>
      </div>

      <button onClick={() => setStarted(true)}
        className="bg-emerald text-emerald-ink font-semibold px-6 py-2.5 rounded-lg hover:bg-emerald-bright">
        Maçı Canlı Oyna
      </button>
      <p className="text-text-faint text-xs mt-2">Gerçek motorla 10 dk (5+5). Hızlandırabilir, oyuncu değiştirebilirsin.</p>

      <Link href="/tactics" className="mt-6 border border-border-cm text-text-2 font-semibold px-6 py-2.5 rounded-lg hover:bg-panel-inset">
        Taktiği Hazırla
      </Link>
      <p className="text-text-faint text-xs mt-3">Rakibin stiline karşı taktiğini maça kadar değiştirebilirsin.</p>
    </div>
  );
}
