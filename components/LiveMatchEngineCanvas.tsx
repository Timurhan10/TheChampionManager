"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchController } from "@/game/matchGame";
import type { EngineTeam, SimResult } from "@/lib/match-engine/simulator";
import { createLiveEngine, TICKS_PER_HALF, TOTAL_TICKS, type LiveEngine, type Side } from "@/lib/match-engine/live/engine";
import MatchTicker from "./MatchTicker";
import type { MatchEvent } from "@/types/game";
import { cn } from "@/lib/utils";

const TICK_MS = 100; // 6000 tick × 100ms = 10 dk (5+5)
type Phase = "idle" | "first" | "halftime" | "second" | "done";

export default function LiveMatchEngineCanvas({
  home, away, homeColor, awayColor, seed, onFinish, mySide = "home",
}: {
  home: EngineTeam;
  away: EngineTeam;
  homeColor: number;
  awayColor: number;
  seed: string;
  onFinish?: (r: SimResult) => void;
  mySide?: Side; // değişiklik panelinin kontrol ettiği taraf (lig maçında deplasman olabilir)
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MatchController | null>(null);
  const engineRef = useRef<LiveEngine | null>(null);
  const evIdxRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [playing, setPlaying] = useState(false);
  const [minute, setMinute] = useState(0);
  const [hs, setHs] = useState(0);
  const [as, setAs] = useState(0);
  const [feed, setFeed] = useState<MatchEvent[]>([]); // kronolojik (ticker için)
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  const [subOut, setSubOut] = useState<string | null>(null);
  const [subVer, setSubVer] = useState(0);
  const [subMsg, setSubMsg] = useState<string | null>(null);

  const SPEEDS = [{ v: 1, label: "Yavaş" }, { v: 4, label: "Orta" }, { v: 16, label: "Çok Hızlı" }];

  // Motoru bir kez kur
  if (!engineRef.current) engineRef.current = createLiveEngine(home, away, seed);

  // Phaser'ı kur
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { createMatchGame } = await import("@/game/matchGame");
      if (!mounted || !containerRef.current) return;
      controllerRef.current = createMatchGame(containerRef.current, { homeColor, awayColor });
      setReady(true);
    })();
    return () => { mounted = false; controllerRef.current?.destroy(); controllerRef.current = null; };
  }, [homeColor, awayColor]);

  function drainEvents() {
    const eng = engineRef.current!; const ctrl = controllerRef.current;
    const evs = eng.getState().events;
    const fresh: MatchEvent[] = [];
    while (evIdxRef.current < evs.length) {
      const ev = evs[evIdxRef.current++];
      if (ev.type === "goal") { ctrl?.trigger("goal", ev.team); }
      else if (ev.type === "save") { ctrl?.trigger("save", ev.team); }
      else if (ev.type === "tackle") { ctrl?.trigger("tackle", ev.team); }
      else if (ev.type === "yellow" || ev.type === "red") { ctrl?.card(ev.team, ev.type); }
      fresh.push(ev);
    }
    if (fresh.length) setFeed((prev) => [...prev, ...fresh]);
  }

  // Tick döngüsü
  useEffect(() => {
    if (!playing || !ready || (phase !== "first" && phase !== "second")) return;
    const eng = engineRef.current!; const ctrl = controllerRef.current;
    const timer = setInterval(() => {
      // hız: her 100ms'de birden çok tick işle (çok hızlı → hemen biter)
      let steps = speedRef.current;
      while (steps-- > 0 && !eng.isFinished()) {
        eng.step();
        if (phase === "first" && eng.getState().tick >= TICKS_PER_HALF) break;
      }
      const st = eng.getState();
      ctrl?.setPositions(st.home.map((p) => ({ x: p.x, y: p.y })), st.away.map((p) => ({ x: p.x, y: p.y })));
      ctrl?.setBall(st.ball.x, st.ball.y);
      ctrl?.setScore(st.homeScore, st.awayScore);
      const half = st.tick < TICKS_PER_HALF ? "İLK YARI" : "İKİNCİ YARI";
      ctrl?.setClock(Math.floor(st.clockMinute), half);
      setMinute(st.clockMinute); setHs(st.homeScore); setAs(st.awayScore);
      drainEvents();

      if (phase === "first" && st.tick >= TICKS_PER_HALF) {
        setPlaying(false); setPhase("halftime"); ctrl?.setClock(45, "DEVRE ARASI");
      } else if (st.tick >= TOTAL_TICKS) {
        setPlaying(false); setPhase("done"); ctrl?.setClock(90, "MAÇ SONU");
        onFinish?.(eng.getResult());
      }
    }, TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, ready, phase]);

  function doSub(inId: string) {
    const eng = engineRef.current; if (!eng || !subOut) return;
    const res = eng.substitute(mySide, subOut, inId);
    if (res.ok) { setSubOut(null); setSubVer((v) => v + 1); setSubMsg(null); }
    else setSubMsg(res.reason ?? "Değişiklik yapılamadı.");
  }

  const dmLabel = phase === "done" ? "MAÇ SONU" : phase === "halftime" ? "DEVRE ARASI" : minute < 45 ? "İLK YARI" : "İKİNCİ YARI";
  const eng0 = engineRef.current;
  const myTeam = mySide === "home" ? home : away;
  const onPitch = eng0 ? eng0.getState()[mySide] : [];
  const onIds = new Set(onPitch.map((p) => p.id));
  const bench = myTeam.players.filter((p) => !onIds.has(p.id));
  const subsLeft = 3 - (eng0?.subsUsed(mySide) ?? 0);
  const canSub = phase !== "idle" && phase !== "done" && subsLeft > 0;

  return (
    <div>
      <div className="bg-panel border border-border-cm rounded-card px-5 py-3 mb-3 flex items-center justify-center gap-6">
        <span className="font-display font-extrabold text-3xl">{hs} - {as}</span>
        <span className="flex items-center gap-2 text-sm">
          {playing && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />}
          <span className="font-display font-bold text-text-2">{Math.floor(minute)}'</span>
          <span className="text-text-faint text-xs">{dmLabel}</span>
        </span>
      </div>

      <div ref={containerRef} className="w-full aspect-[16/10] rounded-card overflow-hidden border border-border-cm bg-bg-base" />

      {/* Haber bandı — canvas'ın hemen altında */}
      <MatchTicker events={feed} />

      <div className="flex items-center gap-2 mt-3 min-h-[40px]">
        {phase === "idle" && (
          <button onClick={() => { setPhase("first"); setPlaying(true); }} disabled={!ready}
            className="bg-emerald text-emerald-ink font-semibold px-5 py-2 rounded-lg hover:bg-emerald-bright text-sm disabled:opacity-50">
            {ready ? "Maçı Başlat" : "Yükleniyor…"}
          </button>
        )}
        {(phase === "first" || phase === "second") && (
          <button onClick={() => setPlaying((p) => !p)} className="bg-emerald text-emerald-ink font-semibold px-4 py-2 rounded-lg hover:bg-emerald-bright text-sm">
            {playing ? "Duraklat" : "Devam"}
          </button>
        )}
        {phase === "halftime" && (
          <button onClick={() => { setPhase("second"); setPlaying(true); }} className="bg-emerald text-emerald-ink font-semibold px-5 py-2 rounded-lg hover:bg-emerald-bright text-sm">
            İkinci Yarıya Başla →
          </button>
        )}
        {phase === "done" && <span className="text-sm text-text-2 font-semibold">Maç bitti.</span>}
        <div className="ml-auto flex gap-1 bg-panel-inset rounded-lg p-1">
          {SPEEDS.map((s) => (
            <button key={s.v} onClick={() => { setSpeed(s.v); speedRef.current = s.v; }}
              className={cn("px-2.5 py-1 rounded text-xs font-semibold", speed === s.v ? "bg-emerald text-emerald-ink" : "text-text-muted hover:text-text-cm")}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Oyuncu değişikliği (kendi takımın) */}
      <div key={subVer} className="mt-4">
        <div className="section-label mb-2 flex items-center justify-between">
          <span>Oyuncu Değişikliği</span>
          <span className="text-xs text-text-faint">Kalan: {subsLeft}</span>
        </div>
        {canSub ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-text-faint mb-1">Çıkacak (sahadaki)</div>
              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                {onPitch.map((p) => {
                  const cond = Math.round((p.condition ?? 1) * 100);
                  const condColor = cond < 55 ? "#EF4444" : cond < 75 ? "#F59E0B" : "#10B981";
                  return (
                    <button key={p.id} onClick={() => setSubOut(p.id)}
                      className={cn("w-full text-left px-2 py-1.5 rounded text-[12px] border", subOut === p.id ? "border-emerald bg-emerald/10 text-emerald" : "border-transparent bg-panel-inset hover:border-border-cm")}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate"><span className="font-bold mr-1">{p.position}</span>{p.name}</span>
                        <span className="tabular-nums text-[10px]" style={{ color: condColor }}>%{cond}</span>
                      </span>
                      <span className="block h-1 rounded-full bg-black/30 mt-1 overflow-hidden">
                        <span className="block h-full rounded-full" style={{ width: `${cond}%`, background: condColor }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-text-faint mb-1">Girecek (yedek){subOut ? "" : " — önce çıkacak oyuncuyu seç"}</div>
              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                {bench.length === 0 && <div className="text-text-muted text-xs py-2">Yedek yok.</div>}
                {bench.map((p) => (
                  <button key={p.id} disabled={!subOut} onClick={() => doSub(p.id)}
                    className={cn("w-full text-left px-2 py-1.5 rounded text-[12px] bg-panel-inset border border-transparent", subOut ? "hover:border-emerald" : "opacity-50")}>
                    <span className="font-bold mr-1">{p.position}</span>{p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-text-muted text-sm">{phase === "idle" ? "Maç başlayınca değişiklik yapabilirsin." : subsLeft <= 0 ? "Değişiklik hakkın bitti (3/3)." : "Maç bitti."}</div>
        )}
        {subMsg && <p className="text-xs text-danger mt-1">{subMsg}</p>}
      </div>
    </div>
  );
}
