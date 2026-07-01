"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

export default function MatchCanvas({
  events, homeColor, awayColor,
}: {
  events: MatchEvent[];
  homeColor: number;
  awayColor: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MatchController | null>(null);
  const sorted = useRef([...events].sort((a, b) => a.minute - b.minute));

  const [minute, setMinute] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);

  const idxRef = useRef(0);
  const minuteRef = useRef(0);
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

  const reset = useCallback(() => {
    idxRef.current = 0; minuteRef.current = 0; hsRef.current = 0; asRef.current = 0;
    setMinute(0); setHomeScore(0); setAwayScore(0); setFeed([]);
    controllerRef.current?.setScore(0, 0);
    controllerRef.current?.setClock(0);
  }, []);

  // Replay döngüsü
  useEffect(() => {
    if (!playing || !ready) return;
    const tickMs = 200 / speed; // 1 dakika ~ 200ms (1x)
    const timer = setInterval(() => {
      const ctrl = controllerRef.current;
      let m = minuteRef.current + 1;
      if (m > 90) { setPlaying(false); return; }
      minuteRef.current = m;
      setMinute(m);

      const half = m < 45 ? "İLK YARI" : "İKİNCİ YARI";
      ctrl?.setClock(m, half);

      // Bu dakikadaki olayları işle
      while (idxRef.current < sorted.current.length && sorted.current[idxRef.current].minute <= m) {
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
    }, tickMs);
    return () => clearInterval(timer);
  }, [playing, speed, ready]);

  const finished = minute >= 90;

  return (
    <div>
      {/* Skor barı */}
      <div className="bg-panel border border-border-cm rounded-card px-5 py-3 mb-3 flex items-center justify-center gap-6">
        <span className="font-display font-extrabold text-3xl">{homeScore} - {awayScore}</span>
        <span className="flex items-center gap-2 text-sm">
          {playing && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />}
          <span className="font-display font-bold text-text-2">{minute}'</span>
          <span className="text-text-faint text-xs">{finished ? "MAÇ SONU" : minute < 45 ? "İLK YARI" : "İKİNCİ YARI"}</span>
        </span>
      </div>

      {/* Phaser canvas */}
      <div ref={containerRef} className="w-full aspect-[16/10] rounded-card overflow-hidden border border-border-cm bg-bg-base" />

      {/* Kontroller */}
      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => { if (finished) reset(); setPlaying((p) => !p); }}
          className="bg-emerald text-emerald-ink font-semibold px-4 py-2 rounded-lg hover:bg-emerald-bright text-sm">
          {playing ? "Duraklat" : finished ? "Tekrar İzle" : minute === 0 ? "Başlat" : "Devam"}
        </button>
        <button onClick={() => { setPlaying(false); reset(); }}
          className="border border-border-cm px-3 py-2 rounded-lg text-sm hover:bg-panel-inset">Baştan</button>
        <div className="ml-auto flex gap-1 bg-panel-inset rounded-lg p-1">
          {[0.5, 1, 2].map((s) => (
            <button key={s} onClick={() => setSpeed(s)}
              className={cn("px-2.5 py-1 rounded text-xs font-semibold", speed === s ? "bg-emerald text-emerald-ink" : "text-text-muted")}>
              {s}x
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
