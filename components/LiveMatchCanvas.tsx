"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchController } from "@/game/matchGame";
import type { MatchEvent } from "@/types/game";
import { cn } from "@/lib/utils";

const EVENT_TAG: Record<string, { label: string; color: string }> = {
  goal: { label: "GOL", color: "#10B981" },
  yellow: { label: "SK", color: "#F59E0B" },
  red: { label: "KRT", color: "#EF4444" },
  sub: { label: "DEĞ", color: "#3B82F6" },
  half_time: { label: "İY", color: "#94A3B8" },
  full_time: { label: "MS", color: "#94A3B8" },
  chance: { label: "FIRSAT", color: "#94A3B8" },
};

// Her yarı 5 gerçek dakika (= 45 gösterim dakikası). Toplam 10 dk.
const HALF_REAL_MS = 5 * 60 * 1000;
const TICK_MS = 100;

type Phase = "idle" | "first" | "halftime" | "second" | "done";

export default function LiveMatchCanvas({
  events, homeColor, awayColor,
}: {
  events: MatchEvent[];
  homeColor: number;
  awayColor: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MatchController | null>(null);
  const sorted = useRef([...events].sort((a, b) => a.minute - b.minute));

  const [phase, setPhase] = useState<Phase>("idle");
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [minute, setMinute] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  const SPEEDS = [{ v: 1, label: "Yavaş" }, { v: 4, label: "Orta" }, { v: 16, label: "Çok Hızlı" }];

  // Stale closure'dan kaçınmak için ref'ler
  const idxRef = useRef(0);
  const elapsedRef = useRef(0);
  const hsRef = useRef(0);
  const asRef = useRef(0);

  // Phaser oyununu oluştur (yalnızca client)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { createMatchGame } = await import("@/game/matchGame");
      if (!mounted || !containerRef.current) return;
      controllerRef.current = createMatchGame(containerRef.current, { homeColor, awayColor });
      setReady(true);
    })();
    return () => {
      mounted = false;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [homeColor, awayColor]);

  // Bir gösterim dakikasına kadar olan olayları işle
  function flushEvents(dm: number) {
    const ctrl = controllerRef.current;
    while (idxRef.current < sorted.current.length && sorted.current[idxRef.current].minute <= dm) {
      const ev = sorted.current[idxRef.current];
      idxRef.current++;
      if (ev.type === "goal") {
        if (ev.team === "home") { hsRef.current++; setHomeScore(hsRef.current); }
        else { asRef.current++; setAwayScore(asRef.current); }
        ctrl?.setScore(hsRef.current, asRef.current);
        ctrl?.goal(ev.team);
      } else if (ev.type === "yellow") {
        ctrl?.card(ev.team, "yellow");
      } else if (ev.type === "red") {
        ctrl?.card(ev.team, "red");
      }
      if (ev.type !== "half_time" && ev.type !== "full_time") {
        setFeed((prev) => [ev, ...prev]);
      }
    }
  }

  // Gerçek zamanlı döngü (yalnızca oynarken ve yarı sürerken)
  useEffect(() => {
    if (!playing || !ready || (phase !== "first" && phase !== "second")) return;
    const ctrl = controllerRef.current;
    const timer = setInterval(() => {
      elapsedRef.current += TICK_MS * speedRef.current;
      const frac = Math.min(1, elapsedRef.current / HALF_REAL_MS);

      if (phase === "first") {
        const dm = frac * 45;
        setMinute(dm);
        ctrl?.setClock(Math.floor(dm), "İLK YARI");
        flushEvents(dm);
        if (frac >= 1) {
          flushEvents(45);
          setPlaying(false);
          setPhase("halftime");
          ctrl?.setClock(45, "DEVRE ARASI");
        }
      } else {
        const dm = 45 + frac * 45;
        setMinute(dm);
        ctrl?.setClock(Math.floor(dm), "İKİNCİ YARI");
        flushEvents(dm);
        if (frac >= 1) {
          flushEvents(90);
          setPlaying(false);
          setPhase("done");
          setMinute(90);
          ctrl?.setClock(90, "MAÇ SONU");
        }
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, ready, phase]);

  function startFirst() {
    elapsedRef.current = 0;
    setPhase("first");
    setPlaying(true);
  }
  function startSecond() {
    elapsedRef.current = 0;
    setPhase("second");
    setPlaying(true);
  }

  const dmLabel = phase === "done" ? "MAÇ SONU"
    : phase === "halftime" ? "DEVRE ARASI"
    : minute < 45 ? "İLK YARI" : "İKİNCİ YARI";

  return (
    <div>
      {/* Skor barı */}
      <div className="bg-panel border border-border-cm rounded-card px-5 py-3 mb-3 flex items-center justify-center gap-6">
        <span className="font-display font-extrabold text-3xl">{homeScore} - {awayScore}</span>
        <span className="flex items-center gap-2 text-sm">
          {playing && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />}
          <span className="font-display font-bold text-text-2">{Math.floor(minute)}'</span>
          <span className="text-text-faint text-xs">{dmLabel}</span>
        </span>
      </div>

      {/* Phaser canvas */}
      <div ref={containerRef} className="w-full aspect-[16/10] rounded-card overflow-hidden border border-border-cm bg-bg-base" />

      {/* Kontroller */}
      <div className="flex items-center gap-2 mt-3 min-h-[40px]">
        {phase === "idle" && (
          <button onClick={startFirst} disabled={!ready}
            className="bg-emerald text-emerald-ink font-semibold px-5 py-2 rounded-lg hover:bg-emerald-bright text-sm disabled:opacity-50">
            {ready ? "Maçı Başlat" : "Yükleniyor…"}
          </button>
        )}
        {(phase === "first" || phase === "second") && (
          <button onClick={() => setPlaying((p) => !p)}
            className="bg-emerald text-emerald-ink font-semibold px-4 py-2 rounded-lg hover:bg-emerald-bright text-sm">
            {playing ? "Duraklat" : "Devam"}
          </button>
        )}
        {phase === "halftime" && (
          <button onClick={startSecond}
            className="bg-emerald text-emerald-ink font-semibold px-5 py-2 rounded-lg hover:bg-emerald-bright text-sm">
            İkinci Yarıya Başla →
          </button>
        )}
        {phase === "done" && (
          <span className="text-sm text-text-2 font-semibold">Maç bitti — sonuç kaydedildi.</span>
        )}
        <div className="ml-auto flex gap-1 bg-panel-inset rounded-lg p-1">
          {SPEEDS.map((s) => (
            <button key={s.v} onClick={() => { setSpeed(s.v); speedRef.current = s.v; }}
              className={cn("px-2.5 py-1 rounded text-xs font-semibold", speed === s.v ? "bg-emerald text-emerald-ink" : "text-text-muted hover:text-text-cm")}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canlı yorum */}
      <div className="mt-4">
        <div className="section-label mb-2">Canlı Yorum</div>
        <div className="bg-panel border border-border-cm rounded-card divide-y divide-border-soft max-h-[240px] overflow-y-auto">
          {feed.length === 0 && <div className="px-4 py-6 text-center text-text-muted text-sm">Maçı başlat — olaylar burada akacak.</div>}
          {feed.map((e, i) => {
            const tag = EVENT_TAG[e.type] ?? EVENT_TAG.chance;
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="font-display font-bold text-sm w-8 text-text-2">{e.minute}'</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${tag.color}22`, color: tag.color }}>{tag.label}</span>
                <span className="text-sm">{e.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
