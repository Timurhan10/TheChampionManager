// The Champion Manager — Canlı maç motoru v2 (FM tarzı, taktik-merkezli)
// Oyuncu özellikleri + taktik + kadro-uyumu maçı belirler. Oyun fazları, takım
// bloğu/savunma hattı, topsuz koşular, geçiş (kontra) pencereleri, kondisyon,
// momentum, faul/kart/korner. Tarayıcıda çalışır; sunucu sonucu doğrular/kaydeder.
//
// Koordinat: x,y ∈ [0,1], YATAY saha. x = uzunluk (kaleler x=0 sol / x=1 sağ),
// y = genişlik. Ev sahibi sağa (x→1) hücum eder, deplasman sola (x→0).

import type { Player, Tactics, MatchEvent } from "@/types/game";
import type { EngineTeam, SimResult, SimStats, PlayerRating } from "../simulator";
import { startingEleven } from "../simulator";
import { computeSquadFit, type FitResult } from "../fit";
import { computeModifiers, type TeamModifiers } from "../modifiers";
import { basePositions } from "./layout";

export const TICKS_PER_SEC = 10;
export const SECONDS_PER_HALF = 300;            // 5 gerçek dakika
export const TICKS_PER_HALF = TICKS_PER_SEC * SECONDS_PER_HALF; // 3000
export const TOTAL_TICKS = TICKS_PER_HALF * 2;  // 6000

// ---- yardımcılar ----
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function A(p: Player, k: string, d = 10): number {
  const v = (p as any)[k];
  return typeof v === "number" ? v : d;
}
function mean(p: Player, keys: string[]): number {
  let s = 0, n = 0;
  for (const k of keys) { const v = (p as any)[k]; if (typeof v === "number") { s += v; n++; } }
  return n ? s / n : 10;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

// ---- durum tipleri ----
export type Side = "home" | "away";
export interface LivePlayer {
  id: string; name: string; position: Player["position"]; side: Side;
  p: Player;
  x: number; y: number; baseX: number; baseY: number;
  condition: number;               // 0..1 — maç içi kondisyon
  run: { tx: number; ty: number; ticksLeft: number } | null; // topsuz koşu
  yellow: boolean;
}
export interface BallState {
  x: number; y: number;
  inFlight: boolean; fromX: number; fromY: number; toX: number; toY: number;
  t: number; dur: number; mode: "pass" | "shot" | "loose" | "corner";
}
export interface LiveState {
  tick: number;
  clockMinute: number;
  homeScore: number; awayScore: number;
  possession: Side; carrier: number;
  ball: BallState;
  home: LivePlayer[]; away: LivePlayer[];
  events: MatchEvent[];
  stats: { shotsHome: number; shotsAway: number; sotHome: number; sotAway: number; possHomeTicks: number; cornersHome: number; cornersAway: number };
  lastEvent: MatchEvent | null;
  momentum: number; // + ev sahibi lehine, [-1, 1]
}

const OPP_GOAL_X: Record<Side, number> = { home: 1, away: 0 };
const OWN_GOAL_X: Record<Side, number> = { home: 0, away: 1 };
const DIR: Record<Side, number> = { home: 1, away: -1 };

function buildSide(team: EngineTeam, side: Side): LivePlayer[] {
  const eleven = startingEleven(team);
  const base = basePositions(team.tactics?.formation ?? "4-4-2", side);
  return eleven.map((p, i) => {
    const b = base[i] ?? { x: side === "home" ? 0.2 : 0.8, y: 0.5 };
    return { id: p.id, name: p.name, position: p.position, side, p, x: b.x, y: b.y, baseX: b.x, baseY: b.y, condition: 1, run: null, yellow: false };
  });
}

export interface LiveEngine {
  step: () => void;
  getState: () => LiveState;
  getResult: () => SimResult;
  isFinished: () => boolean;
  substitute: (side: Side, outId: string, inId: string) => { ok: boolean; reason?: string };
  subsUsed: (side: Side) => number;
  getFit: (side: Side) => FitResult;
}

export function createLiveEngine(home: EngineTeam, away: EngineTeam, seedStr: string): LiveEngine {
  const rng = createRng(hashSeed(seedStr));
  const st: LiveState = {
    tick: 0, clockMinute: 0, homeScore: 0, awayScore: 0,
    possession: rng() < 0.5 ? "home" : "away", carrier: 8,
    ball: { x: 0.5, y: 0.5, inFlight: false, fromX: 0.5, fromY: 0.5, toX: 0.5, toY: 0.5, t: 0, dur: 1, mode: "loose" },
    home: buildSide(home, "home"), away: buildSide(away, "away"),
    events: [], lastEvent: null, momentum: 0,
    stats: { shotsHome: 0, shotsAway: 0, sotHome: 0, sotAway: 0, possHomeTicks: 0, cornersHome: 0, cornersAway: 0 },
  };
  const tactics: Record<Side, Tactics | null> = { home: home.tactics, away: away.tactics };
  const teamName: Record<Side, string> = { home: home.name, away: away.name };
  const squads: Record<Side, Player[]> = { home: home.players, away: away.players };
  const subsUsed: Record<Side, number> = { home: 0, away: 0 };

  // Taktik-uyum + çarpanlar (oyunun kalbi)
  const fit: Record<Side, FitResult> = {
    home: computeSquadFit(home.players, home.tactics),
    away: computeSquadFit(away.players, away.tactics),
  };
  const mods: Record<Side, TeamModifiers> = {
    home: computeModifiers(home.tactics, fit.home, home.players),
    away: computeModifiers(away.tactics, fit.away, away.players),
  };

  let holdTicks = 0;
  let decisionIn = 6;
  // gecikmeli geçişler (top uçuşu bitince uygulanır)
  let pendingCarrier = -1;
  let pendingTurnover: MatchEvent["type"] | null = null;
  let pendingTurnoverBy: LivePlayer | undefined;
  let pendingKickoffTo: Side | null = null;
  let pendingCorner: Side | null = null;
  let pendingAerial = -1; // uzun top hedef index'i (havada düello)
  let prevCarrierIdx = -1; // give-and-go için
  // geçiş (kontra) penceresi + karşı-pres
  let transitionSide: Side | null = null;
  let transitionTicks = 0;
  let counterPressSide: Side | null = null;
  let counterPressTicks = 0;
  let halftimeApplied = false;

  const sideArr = (s: Side) => (s === "home" ? st.home : st.away);
  const opp = (s: Side): Side => (s === "home" ? "away" : "home");
  const carrierP = () => sideArr(st.possession)[st.carrier];
  const mSide = (s: Side) => (s === "home" ? st.momentum : -st.momentum);

  // Takım gücü + beklenen gol (xG) — golü buna bağlayarak sonucu güç-duyarlı tutar.
  const OFF = ["shooting", "long_shots", "off_the_ball", "dribbling", "technique", "pace", "composure", "first_touch"];
  const DEFA = ["tackling", "positioning", "strength", "anticipation", "concentration", "heading", "jumping"];
  const GKA = ["reflexes", "handling", "one_on_ones", "command_of_area", "positioning"];
  const teamAtt = (s: Side) => { const arr = sideArr(s); let sum = 0, w = 0; for (const pl of arr) { const wt = pl.position === "FW" ? 1 : pl.position === "MF" ? 0.55 : pl.position === "DF" ? 0.15 : 0; sum += wt * mean(pl.p, OFF); w += wt; } return w ? sum / w : 10; };
  const teamDef = (s: Side) => { const arr = sideArr(s); let sum = 0, w = 0; for (const pl of arr) { const wt = pl.position === "GK" ? 1 : pl.position === "DF" ? 1 : pl.position === "MF" ? 0.4 : 0.1; sum += wt * mean(pl.p, pl.position === "GK" ? GKA : DEFA); w += wt; } return w ? sum / w : 10; };
  const mentA = (t: Tactics | null) => t?.mentality === "attacking" ? 1.2 : t?.mentality === "defensive" ? 0.82 : 1;
  const mentD = (t: Tactics | null) => t?.mentality === "attacking" ? 1.1 : t?.mentality === "defensive" ? 0.88 : 1;
  const xgCalc = (att: number, oppDef: number, mA: number, press: number, homeAdv: number) => clamp((1.15 + (att - oppDef) * 0.12) * mA * press + homeAdv, 0.35, 3.2);
  const xgOf: Record<Side, number> = {
    home: xgCalc(teamAtt("home"), teamDef("away") * mentD(tactics.away), mentA(tactics.home), mods.home.pressIntensity, 0.3) * mods.home.xgMult * mods.away.oppXgMult,
    away: xgCalc(teamAtt("away"), teamDef("home") * mentD(tactics.home), mentA(tactics.away), mods.away.pressIntensity, 0.0) * mods.away.xgMult * mods.home.oppXgMult,
  };
  const lastShot: Record<Side, number> = { home: -999, away: -999 };
  const SHOT_COOLDOWN = 260;
  let lastTackleAttempt = -99; // müdahale denemesi bekleme süresi (her tick değil)

  function emit(type: MatchEvent["type"], side: Side, text: string, importance = 0, player?: LivePlayer) {
    const ev: MatchEvent = { minute: Math.max(1, Math.round(st.clockMinute)), type, team: side, text, importance, playerId: player?.id, playerName: player?.name };
    st.events.push(ev);
    st.lastEvent = ev;
  }

  function nextDecisionIn(base = 11): number {
    return Math.max(4, Math.round((base + rng() * 10) * mods[st.possession].decisionMult));
  }

  // Topa en yakın rakip
  function nearestOpponent(toSide: Side, x: number, y: number): { pl: LivePlayer; d: number; idx: number } {
    const arr = sideArr(opp(toSide));
    let best = arr[0], bd = Infinity, bi = 0;
    for (let i = 0; i < arr.length; i++) { const d = dist(arr[i].x, arr[i].y, x, y); if (d < bd) { bd = d; best = arr[i]; bi = i; } }
    return { pl: best, d: bd, idx: bi };
  }

  function setBallFlight(toX: number, toY: number, mode: BallState["mode"], speedTicks: number) {
    const b = st.ball;
    b.fromX = b.x; b.fromY = b.y; b.toX = toX; b.toY = toY; b.t = 0; b.dur = Math.max(2, speedTicks); b.inFlight = true; b.mode = mode;
  }

  function clearRuns(s: Side) { for (const pl of sideArr(s)) pl.run = null; }

  function turnover(byPlayer?: LivePlayer, announce = true) {
    const loser = st.possession;
    const winner = opp(loser);
    if (announce && byPlayer) emit("tackle", winner, `${byPlayer.name} topu kazandı.`, 1, byPlayer);
    st.possession = winner;
    clearRuns(loser);
    // yeni taşıyıcı: topa en yakın oyuncu
    const arr = sideArr(winner);
    let best = 0, bd = Infinity;
    for (let i = 0; i < arr.length; i++) { const d = dist(arr[i].x, arr[i].y, st.ball.x, st.ball.y); if (d < bd) { bd = d; best = i; } }
    st.carrier = best;
    st.ball.inFlight = false;
    prevCarrierIdx = -1;
    holdTicks = 0; decisionIn = nextDecisionIn();

    // Geçiş penceresi: kazanan taraf kontra fırsatı yakalar
    transitionSide = winner; transitionTicks = 60;
    if (mods[winner].counterBoost > 1.05) {
      // kontra stili: hücumcular otomatik ileri koşar
      const d = DIR[winner];
      for (const pl of arr) {
        if (pl.position === "FW" || (pl.position === "MF" && rng() < 0.4)) {
          pl.run = { tx: clamp(st.ball.x + d * (0.2 + rng() * 0.15), 0.05, 0.95), ty: clamp(pl.baseY + (rng() - 0.5) * 0.2, 0.06, 0.94), ticksLeft: 26 };
        }
      }
      decisionIn = Math.max(3, Math.round(decisionIn / 2));
    }
    // Gegenpress: topu kaybeden 20 tick karşı-pres yapar
    if (mods[loser].pressIntensity >= 1.15) {
      counterPressSide = loser; counterPressTicks = 20;
    }
  }

  function nearestToCenter(s: Side): number {
    const arr = sideArr(s);
    let best = arr.length > 1 ? 1 : 0, bd = Infinity;
    for (let i = 1; i < arr.length; i++) {
      const d = dist(arr[i].x, arr[i].y, 0.5, 0.5);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function kickoff(toSide: Side) {
    st.possession = toSide;
    clearRuns("home"); clearRuns("away");
    st.carrier = nearestToCenter(toSide);
    const c = sideArr(toSide)[st.carrier];
    st.ball.x = 0.5; st.ball.y = 0.5; st.ball.inFlight = false; st.ball.mode = "loose";
    if (c) { c.x = 0.5; c.y = 0.5; }
    transitionSide = null; transitionTicks = 0;
    holdTicks = 0; decisionIn = nextDecisionIn(6);
  }

  // ---- faz + pozisyon hedefleri ----
  type PlayPhase = "build_up" | "progression" | "final_third";
  function possessionPhase(s: Side): PlayPhase {
    const prog = Math.abs(st.ball.x - OWN_GOAL_X[s]);
    return prog < 0.33 ? "build_up" : prog < 0.66 ? "progression" : "final_third";
  }

  // Topsuz koşu başlat (hücum eden taraf için)
  function maybeStartRun(s: Side, phase: PlayPhase) {
    if (phase === "build_up") return;
    if (rng() > 0.028 / mods[s].decisionMult) return;
    const arr = sideArr(s);
    const d = DIR[s];
    const instr = (tactics[s]?.player_instructions ?? {}) as Record<string, any>;
    // aday: koşusu olmayan FW/MF (taşıyıcı hariç)
    let bestI = -1, bestW = -Infinity;
    for (let i = 1; i < arr.length; i++) {
      if (i === st.carrier && s === st.possession) continue;
      const pl = arr[i];
      if (pl.run || (pl.position !== "FW" && pl.position !== "MF")) continue;
      let w = A(pl.p, "off_the_ball") + A(pl.p, "pace") + rng() * 8;
      const ins = instr[pl.id];
      if (ins?.run === "forward") w *= 1.5;
      if (ins?.run === "wide") w *= 1.3;
      w *= 0.6 + 0.4 * pl.condition;
      if (w > bestW) { bestW = w; bestI = i; }
    }
    if (bestI < 0) return;
    const pl = arr[bestI];
    const ins = instr[pl.id];
    const style = tactics[s]?.style;
    // kanal: kanat oyunu dış koridor, tiki-taka yarı alan; talimat wide → dış
    let laneY = clamp(pl.baseY + (rng() - 0.5) * 0.24, 0.06, 0.94);
    if (style === "wing_play" || ins?.run === "wide") laneY = pl.baseY < 0.5 ? clamp(pl.baseY - 0.12, 0.06, 0.4) : clamp(pl.baseY + 0.12, 0.6, 0.94);
    pl.run = {
      tx: clamp(st.ball.x + d * (0.15 + rng() * 0.12), 0.05, 0.95),
      ty: laneY,
      ticksLeft: 20 + Math.floor(rng() * 20),
    };
  }

  // Pas hedefi: ileri + açık + koşudaki adam
  function choosePassTarget(carrier: LivePlayer): number {
    const arr = sideArr(st.possession);
    const goalX = OPP_GOAL_X[st.possession];
    const t = tactics[st.possession];
    const longStyle = t?.pass_style === "long";
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < arr.length; i++) {
      if (i === st.carrier) continue;
      const tm = arr[i];
      const forward = (Math.abs(tm.x - goalX) < Math.abs(carrier.x - goalX)) ? 1 : 0;
      const openness = nearestOpponent(st.possession, tm.x, tm.y).d;
      const d = dist(carrier.x, carrier.y, tm.x, tm.y);
      let score = forward * 1.4 + openness * 2.0 - d * 1.2 + rng() * 0.5;
      if (tm.run && openness > 0.06) score += 2.2; // ara pası: koşudaki açık adam
      if (longStyle && d > 0.3 && forward) score += 1.2 * (A(carrier.p, "long_balls") / 20); // uzun top
      if (t?.style === "wing_play" && (tm.y < 0.22 || tm.y > 0.78)) score += 0.8; // kanada aç
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best >= 0 ? best : (st.carrier + 1) % arr.length;
  }

  function inTransition(s: Side): boolean {
    return transitionSide === s && transitionTicks > 0;
  }

  function decide(carrier: LivePlayer) {
    const goalX = OPP_GOAL_X[st.possession];
    const dGoal = Math.abs(carrier.x - goalX);
    const pressure = nearestOpponent(st.possession, carrier.x, carrier.y).d;
    const t = tactics[st.possession];
    const instr = ((t?.player_instructions ?? {}) as Record<string, any>)[carrier.id];
    const shootMult = instr?.shooting === "often" ? 1.3 : instr?.shooting === "rare" ? 0.7 : 1;
    const ment = t?.mentality === "attacking" ? 1.25 : t?.mentality === "defensive" ? 0.8 : 1;

    const shootRange = 0.34;
    const inRange = dGoal < shootRange && Math.abs(carrier.y - 0.5) < 0.3;
    const shootScore = inRange
      ? (A(carrier.p, "shooting") + A(carrier.p, "composure") + A(carrier.p, "technique")) / 3 * ment * shootMult
        * (1 - 0.6 * (dGoal / shootRange)) + rng() * 5
      : -1;
    const passScore = (A(carrier.p, "passing") + A(carrier.p, "vision") + A(carrier.p, "decisions")) / 3
      + (pressure < 0.08 ? -2 : 3.5) + rng() * 3;

    const canShoot = st.tick - lastShot[st.possession] >= SHOT_COOLDOWN;
    if (shootScore > passScore && inRange && canShoot) {
      resolveShot(carrier);
    } else {
      resolvePass(carrier);
    }
  }

  function resolvePass(carrier: LivePlayer) {
    const targetIdx = choosePassTarget(carrier);
    const arr = sideArr(st.possession);
    const target = arr[targetIdx];
    const d = dist(carrier.x, carrier.y, target.x, target.y);
    const pressure = nearestOpponent(st.possession, carrier.x, carrier.y).d;
    const t = tactics[st.possession];
    const skill = (A(carrier.p, "passing") + A(carrier.p, "technique") + A(carrier.p, "decisions")) / 3 * (0.75 + 0.25 * carrier.condition);
    let prob = 0.55 + (skill - 10) * 0.03 - d * 0.35 - (pressure < 0.07 ? 0.15 : 0)
      + mods[st.possession].passBonus + 0.03 * mSide(st.possession)
      - (t?.pass_style === "long" ? 0.06 : 0);
    prob = clamp(prob, 0.32, 0.95);
    if (rng() < prob) {
      setBallFlight(target.x, target.y, "pass", Math.round(4 + d * 20));
      pendingCarrier = targetIdx;
      pendingAerial = d > 0.32 ? targetIdx : -1; // uzun top: varışta hava düellosu
      prevCarrierIdx = st.carrier;
    } else {
      const o = nearestOpponent(st.possession, target.x, target.y);
      setBallFlight(o.pl.x, o.pl.y, "loose", Math.round(4 + d * 18));
      pendingTurnover = "tackle"; pendingTurnoverBy = o.pl;
    }
    holdTicks = 0; decisionIn = nextDecisionIn();
  }

  function resolveShot(shooter: LivePlayer) {
    const side = st.possession;
    const goalX = OPP_GOAL_X[side];
    const dGoal = Math.abs(shooter.x - goalX);
    const pressure = nearestOpponent(side, shooter.x, shooter.y).d;
    const defSide = opp(side);
    const gk = sideArr(defSide).find((pl) => pl.position === "GK") ?? sideArr(defSide)[0];
    if (side === "home") st.stats.shotsHome++; else st.stats.shotsAway++;
    lastShot[side] = st.tick;

    const counter = inTransition(side) && mods[side].counterBoost > 1.02;
    if (counter) emit("counter", side, `Hızlı hücum! ${shooter.name} ileri çıktı.`, 1, shooter);
    emit("shot", side, `${shooter.name} şutunu çekti!`, 1, shooter);

    const quality = ((A(shooter.p, "shooting") * 1.2 + A(shooter.p, "composure") + A(shooter.p, "technique")) / 3.2
      * (1 - dGoal / 0.5) - (pressure < 0.06 ? 3 : 0) + rng() * 4) * (0.8 + 0.2 * shooter.condition)
      + 0.5 * mSide(side);

    setBallFlight(goalX, 0.5, "shot", 4);

    const onTarget = quality > 4 && rng() < clamp(0.32 + (quality - 9) * 0.04, 0.2, 0.62);
    if (!onTarget) {
      if (rng() < 0.35) {
        // korner
        if (side === "home") st.stats.cornersHome++; else st.stats.cornersAway++;
        emit("corner", side, `Korner — ${teamName[side]}.`, 0);
        pendingCorner = side;
        st.ball.toX = goalX; st.ball.toY = rng() < 0.5 ? 0.04 : 0.96;
      } else {
        emit("miss", side, `${shooter.name}'in şutu az farkla dışarı.`, 0, shooter);
        pendingKickoffTo = defSide;
      }
      return;
    }
    if (side === "home") st.stats.sotHome++; else st.stats.sotAway++;

    const counterFactor = counter ? mods[side].counterBoost : 1;
    const goalProb = clamp(xgOf[side] / 8.5, 0.05, 0.38) * clamp(quality / 9, 0.65, 1.5) * counterFactor * (1 + 0.10 * mSide(side));
    if (rng() < goalProb) {
      if (side === "home") st.homeScore++; else st.awayScore++;
      emit("goal", side, `GOL! ${shooter.name} ${teamName[side]} adına fileleri buldu.`, 3, shooter);
      st.momentum = clamp(st.momentum + (side === "home" ? 0.6 : -0.6), -1, 1);
      pendingKickoffTo = defSide;
    } else {
      emit("save", defSide, `${gk.name} müthiş kurtardı!`, 2, gk);
      st.momentum = clamp(st.momentum + (defSide === "home" ? 0.25 : -0.25), -1, 1);
      pendingKickoffTo = defSide;
    }
  }

  // Korner çözümü: orta + hava topu düellosu
  function resolveCorner(side: Side) {
    const atk = sideArr(side);
    const def = sideArr(opp(side));
    // en iyi kafa vuran hücumcu vs savunma hava ortalaması
    let header = atk[1] ?? atk[0];
    let bestH = -Infinity;
    for (const pl of atk) {
      if (pl.position === "GK") continue;
      const h = mean(pl.p, ["heading", "jumping"]);
      if (h > bestH) { bestH = h; header = pl; }
    }
    const defAir = def.filter((p) => p.position === "DF").reduce((s, p) => s + mean(p.p, ["heading", "jumping", "strength"]), 0) / Math.max(1, def.filter((p) => p.position === "DF").length);
    const pHead = clamp(0.25 + (bestH - defAir) * 0.02, 0.1, 0.45);
    st.ball.inFlight = false;
    st.ball.x = OPP_GOAL_X[side] === 1 ? 0.92 : 0.08; st.ball.y = 0.5;
    if (rng() < pHead) {
      // kafa şutu
      st.possession = side;
      st.carrier = atk.indexOf(header);
      if (side === "home") st.stats.shotsHome++; else st.stats.shotsAway++;
      emit("shot", side, `${header.name} kafayı vurdu!`, 1, header);
      const gk = def.find((p) => p.position === "GK") ?? def[0];
      const q = mean(header.p, ["heading", "jumping"]) * 0.9 + rng() * 4;
      setBallFlight(OPP_GOAL_X[side], 0.5, "shot", 3);
      const goalProb = clamp(xgOf[side] / 9.5, 0.04, 0.3) * clamp(q / 10, 0.6, 1.3);
      if (rng() < clamp(0.32 + (q - 9) * 0.04, 0.2, 0.55)) {
        if (side === "home") st.stats.sotHome++; else st.stats.sotAway++;
        if (rng() < goalProb) {
          if (side === "home") st.homeScore++; else st.awayScore++;
          emit("goal", side, `GOL! ${header.name} kornerden kafayla tamamladı!`, 3, header);
          st.momentum = clamp(st.momentum + (side === "home" ? 0.6 : -0.6), -1, 1);
        } else {
          emit("save", opp(side), `${gk.name} kafa vuruşunu çıkardı!`, 2, gk);
        }
      } else {
        emit("miss", side, `${header.name}'in kafası dışarı.`, 0, header);
      }
      pendingKickoffTo = opp(side);
    } else {
      // savunma uzaklaştırdı
      st.possession = opp(side);
      st.carrier = nearestToCenter(opp(side));
      holdTicks = 0; decisionIn = nextDecisionIn();
    }
  }

  // Faul + kart (müdahale eden savunmacı için)
  function maybeFoulCard(tackler: LivePlayer, tacklerIdx: number, defSide: Side): boolean {
    const pFoul = 0.05 + A(tackler.p, "aggression") / 400; // deneme başına ~%7-10
    if (rng() >= pFoul) return false;
    emit("foul", defSide, `${tackler.name} faul yaptı.`, 0, tackler);
    const pYellow = clamp(0.10 + (A(tackler.p, "aggression") - A(tackler.p, "composure")) / 100, 0.03, 0.35);
    if (rng() < pYellow && tackler.position !== "GK") {
      if (tackler.yellow) {
        emit("red", defSide, `KIRMIZI KART! ${tackler.name} ikinci sarıdan atıldı — ${teamName[defSide]} 10 kişi.`, 3, tackler);
        const arr = sideArr(defSide);
        arr.splice(tacklerIdx, 1);
        // taşıyıcı index'i savunan dizide değil; carrier possession tarafında güvende
      } else {
        tackler.yellow = true;
        emit("yellow", defSide, `Sarı kart — ${tackler.name}.`, 2, tackler);
      }
    }
    // faul: top hücum eden tarafta kalır, oyun hızlıca devam eder
    holdTicks = 0; decisionIn = 6;
    return true;
  }

  // ---- hareket: fazlar + blok + koşular ----
  function movePlayers() {
    const possSide = st.possession;
    const phase = possessionPhase(possSide);
    maybeStartRun(possSide, phase);

    for (const s of ["home", "away"] as Side[]) {
      const arr = sideArr(s);
      const attacking = s === possSide;
      const d = DIR[s];
      const ownX = OWN_GOAL_X[s];
      const m = mods[s];
      const t = tactics[s];

      // savunmada: en yakın (pres) + ikinci en yakın (kanal kesme)
      let near = -1, near2 = -1, nd = Infinity, nd2 = Infinity;
      if (!attacking) {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].position === "GK") continue;
          const dd = dist(arr[i].x, arr[i].y, st.ball.x, st.ball.y);
          if (dd < nd) { nd2 = nd; near2 = near; nd = dd; near = i; }
          else if (dd < nd2) { nd2 = dd; near2 = i; }
        }
      }
      // savunma hattı: topla birlikte geri kaçar
      const ballFromOwn = Math.abs(st.ball.x - ownX);
      const lineX = clamp(Math.min(m.lineHeight, ballFromOwn - 0.05), 0.07, 0.5);
      // hücum bloğu: top ilerledikçe blok ilerler
      const prog = Math.abs(st.ball.x - OWN_GOAL_X[possSide]);
      const blockX = clamp(prog - 0.25, 0, 0.55);
      const push = (phase === "final_third" ? 0.12 : phase === "progression" ? 0.06 : 0)
        + (t?.mentality === "attacking" ? 0.04 : t?.mentality === "defensive" ? -0.04 : 0);

      for (let i = 0; i < arr.length; i++) {
        const pl = arr[i];
        let tx = pl.baseX, ty = pl.baseY;
        let sprint = false;

        if (pl.position === "GK") {
          tx = ownX + d * 0.04;
          ty = 0.5 + (st.ball.y - 0.5) * 0.25;
        } else if (attacking && i === st.carrier && !st.ball.inFlight) {
          // taşıyıcı: sürüş — ileri + yanal salınım
          const sway = Math.sin(st.tick / 9 + i) * 0.05;
          tx = pl.x + d * 0.07 * (0.5 + A(pl.p, "dribbling") / 20);
          ty = clamp(pl.y + sway * 0.3, 0.06, 0.94);
        } else if (attacking && pl.run) {
          tx = pl.run.tx; ty = pl.run.ty; sprint = true;
          pl.run.ticksLeft--;
          if (pl.run.ticksLeft <= 0) pl.run = null;
        } else if (attacking) {
          // blok + derinlik + faz itmesi; hücum hattı sahayı gerer (FW hep ileride)
          const depth = Math.abs(pl.baseX - ownX);
          const rf = pl.position === "FW" ? 1 : pl.position === "MF" ? 0.6 : 0.3;
          const mentMult = t?.mentality === "attacking" ? 1.15 : t?.mentality === "defensive" ? 0.8 : 1;
          const attackDepth = Math.max(blockX + depth * 0.9 + push, depth + rf * 0.38 * mentMult);
          tx = ownX + d * clamp(attackDepth, 0.04, 0.95);
          ty = clamp(0.5 + (pl.baseY - 0.5) * m.widthScale + (st.ball.y - 0.5) * 0.15, 0.05, 0.95);
        } else if (i === near) {
          // pres
          tx = st.ball.x; ty = st.ball.y; sprint = true;
        } else if (i === near2) {
          // ikinci savunmacı: topla en ileri koşucu arasındaki kanalı kes
          const runners = sideArr(possSide).filter((p) => p.run);
          const target = runners.length ? runners[0] : null;
          if (target) { tx = (st.ball.x + target.x) / 2; ty = (st.ball.y + target.y) / 2; }
          else { tx = st.ball.x + (ownX - st.ball.x) * 0.3; ty = st.ball.y + (0.5 - st.ball.y) * 0.3; }
        } else {
          // blok: hat + rol derinliği; kompakt, topa kayar
          const roleDepth = pl.position === "DF" ? 0 : pl.position === "MF" ? 0.14 : 0.30;
          const jitter = ((i * 37) % 10) / 500; // hat düz görünmesin (deterministik)
          tx = ownX + d * (lineX + roleDepth + jitter);
          ty = clamp(0.5 + (pl.baseY - 0.5) * 0.75 + (st.ball.y - 0.5) * 0.35, 0.05, 0.95);
        }

        tx = clamp(tx, 0.02, 0.98); ty = clamp(ty, 0.03, 0.97);
        const pace = (0.55 * A(pl.p, "pace") + 0.45 * A(pl.p, "acceleration", 10)) / 20;
        let spd = (0.018 + pace * 0.03) * (0.55 + 0.45 * pl.condition);
        if (sprint) spd *= 1.25;
        if (attacking && i === st.carrier) spd *= 0.72;
        pl.x += clamp(tx - pl.x, -spd, spd);
        pl.y += clamp(ty - pl.y, -spd, spd);
      }
    }
    if (!st.ball.inFlight) { const c = carrierP(); if (c) { st.ball.x = c.x; st.ball.y = c.y; } }
  }

  // ---- kondisyon ----
  function drainCondition() {
    for (const s of ["home", "away"] as Side[]) {
      const arr = sideArr(s);
      const dm = mods[s].drainMult;
      for (const pl of arr) {
        let act = 1;
        if (pl.run) act = 2.5;
        const fitness = (A(pl.p, "stamina") + A(pl.p, "natural_fitness", 10)) / 40; // 0..1
        pl.condition = clamp(pl.condition - 0.00004 * act * dm * (1.7 - fitness), 0.3, 1);
      }
    }
    // karşı-pres ekstra yorar
    if (counterPressSide && counterPressTicks > 0) {
      const arr = sideArr(counterPressSide);
      const sorted = [...arr].filter((p) => p.position !== "GK")
        .sort((a, b) => dist(a.x, a.y, st.ball.x, st.ball.y) - dist(b.x, b.y, st.ball.x, st.ball.y))
        .slice(0, 3);
      for (const pl of sorted) pl.condition = clamp(pl.condition - 0.0001, 0.3, 1);
    }
  }

  function step() {
    if (st.tick >= TOTAL_TICKS) return;
    st.tick++;
    st.clockMinute = (st.tick / TOTAL_TICKS) * 90;
    if (st.possession === "home") st.stats.possHomeTicks++;
    st.momentum *= 0.995;
    if (transitionTicks > 0) transitionTicks--;
    if (counterPressTicks > 0) { counterPressTicks--; if (counterPressTicks === 0) counterPressSide = null; }

    // devre arası toparlanması (bir kez)
    if (!halftimeApplied && st.tick >= TICKS_PER_HALF) {
      halftimeApplied = true;
      for (const s of ["home", "away"] as Side[]) for (const pl of sideArr(s)) {
        pl.condition = clamp(pl.condition + 0.08 * (A(pl.p, "natural_fitness", 10) / 20), 0.3, 1);
      }
    }

    // top uçuşu
    if (st.ball.inFlight) {
      const b = st.ball;
      b.t++;
      const k = clamp(b.t / b.dur, 0, 1);
      b.x = b.fromX + (b.toX - b.fromX) * k;
      b.y = b.fromY + (b.toY - b.fromY) * k;
      if (k >= 1) {
        b.inFlight = false;
        if (pendingCorner) { const cs = pendingCorner; pendingCorner = null; resolveCorner(cs); }
        else if (pendingKickoffTo) { const to = pendingKickoffTo; pendingKickoffTo = null; kickoff(to); }
        else if (pendingTurnover) { pendingTurnover = null; turnover(pendingTurnoverBy); pendingTurnoverBy = undefined; }
        else if (pendingCarrier >= 0) {
          const arr = sideArr(st.possession);
          const idx = Math.min(pendingCarrier, arr.length - 1);
          pendingCarrier = -1;
          // uzun top: varışta hava düellosu
          if (pendingAerial >= 0) {
            pendingAerial = -1;
            const recv = arr[idx];
            const marker = nearestOpponent(st.possession, recv.x, recv.y);
            if (marker.d < 0.06) {
              const atkAir = mean(recv.p, ["heading", "jumping", "strength"]);
              const defAir = mean(marker.pl.p, ["heading", "jumping", "strength"]);
              if (rng() < clamp(0.5 + (defAir - atkAir) * 0.03, 0.25, 0.75)) {
                st.ball.x = marker.pl.x; st.ball.y = marker.pl.y;
                turnover(marker.pl, false);
                movePlayers(); drainCondition();
                return;
              }
            }
          }
          st.carrier = idx;
          const c = carrierP(); if (c) { st.ball.x = c.x; st.ball.y = c.y; }
          // give-and-go: pası veren ileri koşabilir
          if (prevCarrierIdx >= 0 && prevCarrierIdx < arr.length && prevCarrierIdx !== idx) {
            const giver = arr[prevCarrierIdx];
            if (!giver.run && rng() < 0.35 * (A(giver.p, "off_the_ball") / 20)) {
              const d = DIR[st.possession];
              giver.run = { tx: clamp(st.ball.x + d * (0.12 + rng() * 0.1), 0.05, 0.95), ty: clamp(giver.y + (rng() - 0.5) * 0.15, 0.06, 0.94), ticksLeft: 22 };
            }
          }
          prevCarrierIdx = -1;
        }
      }
    } else {
      holdTicks++;
      const c = carrierP();
      if (c) {
        const defSide = opp(st.possession);
        const near = nearestOpponent(st.possession, c.x, c.y);
        const pi = mods[defSide].pressIntensity * (counterPressSide === defSide && counterPressTicks > 0 ? 1.3 : 1);
        const engageR = 0.045 * pi;
        if (near.d < engageR && st.tick - lastTackleAttempt >= 6) {
          lastTackleAttempt = st.tick;
          const tackle = (A(near.pl.p, "tackling") + A(near.pl.p, "positioning") + A(near.pl.p, "strength") + A(near.pl.p, "aggression")) / 4
            * pi * (0.75 + 0.25 * near.pl.condition);
          const evade = (A(c.p, "dribbling") + A(c.p, "agility", 10) + A(c.p, "technique")) / 3 * (0.75 + 0.25 * c.condition);
          const bonus = counterPressSide === defSide && counterPressTicks > 0 ? 0.06 : 0;
          const pTackle = clamp(0.08 + (tackle - evade) * 0.018 + bonus, 0.02, 0.4);
          if (rng() < pTackle) {
            turnover(near.pl);
          } else if (maybeFoulCard(near.pl, near.idx, defSide)) {
            // faul — top hücum edende kalır (serbest vuruş etkisi: kısa bekleme)
          }
        }
        if (holdTicks >= decisionIn && !st.ball.inFlight) { decide(c); }
      }
    }

    movePlayers();
    drainCondition();
  }

  function ratePlayers(): PlayerRating[] {
    const out: PlayerRating[] = [];
    for (const s of ["home", "away"] as Side[]) {
      const gf = s === "home" ? st.homeScore : st.awayScore;
      const ga = s === "home" ? st.awayScore : st.homeScore;
      const resAdj = gf > ga ? 0.5 : gf < ga ? -0.4 : 0;
      for (const pl of sideArr(s)) {
        let r = 6 + resAdj;
        const goals = st.events.filter((e) => e.type === "goal" && e.team === s && e.playerId === pl.id).length;
        r += goals * 1.1;
        if (pl.position === "GK") r += ga === 0 ? 0.8 : -0.35 * ga;
        else if (pl.position === "DF") r += ga === 0 ? 0.4 : -0.15 * ga;
        const yellow = st.events.some((e) => e.type === "yellow" && e.playerId === pl.id);
        const red = st.events.some((e) => e.type === "red" && e.playerId === pl.id);
        if (yellow) r -= 0.3;
        if (red) r -= 1.5;
        r += (rng() - 0.5) * 0.5;
        out.push({ playerId: pl.id, name: pl.name, team: s, rating: Math.round(clamp(r, 3, 10) * 10) / 10 });
      }
    }
    return out;
  }

  function getResult(): SimResult {
    const events = [...st.events];
    const htH = events.filter((e) => e.type === "goal" && e.team === "home" && e.minute <= 45).length;
    const htA = events.filter((e) => e.type === "goal" && e.team === "away" && e.minute <= 45).length;
    events.push({ minute: 45, type: "half_time", team: "home", text: `İlk yarı sonu: ${htH}-${htA}` });
    events.push({ minute: 90, type: "full_time", team: "home", text: `Maç sonu: ${st.homeScore}-${st.awayScore}` });
    events.sort((a, b) => a.minute - b.minute);

    const possHome = clamp(Math.round((st.stats.possHomeTicks / Math.max(1, st.tick)) * 100), 30, 70);
    const stats: SimStats = {
      possessionHome: possHome,
      shotsHome: st.stats.shotsHome, shotsAway: st.stats.shotsAway,
      sotHome: st.stats.sotHome, sotAway: st.stats.sotAway,
      cornersHome: st.stats.cornersHome, cornersAway: st.stats.cornersAway,
    };
    const ratings = ratePlayers();
    const goals = events.filter((e) => e.type === "goal");
    let motm: SimResult["manOfTheMatch"] = null;
    if (goals.length) { const g = goals[Math.floor(rng() * goals.length)]; motm = { playerId: g.playerId!, name: g.playerName!, team: g.team }; }
    else { const best = [...ratings].sort((a, b) => b.rating - a.rating)[0]; if (best) motm = { playerId: best.playerId, name: best.name, team: best.team }; }

    return { homeScore: st.homeScore, awayScore: st.awayScore, events, stats, manOfTheMatch: motm, playerRatings: ratings };
  }

  function substitute(side: Side, outId: string, inId: string): { ok: boolean; reason?: string } {
    if (subsUsed[side] >= 3) return { ok: false, reason: "En fazla 3 değişiklik." };
    const arr = sideArr(side);
    const idx = arr.findIndex((pl) => pl.id === outId);
    if (idx < 0) return { ok: false, reason: "Sahadaki oyuncu bulunamadı." };
    if (arr.some((pl) => pl.id === inId)) return { ok: false, reason: "Oyuncu zaten sahada." };
    const inP = squads[side].find((p) => p.id === inId);
    if (!inP) return { ok: false, reason: "Yedek bulunamadı." };
    const out = arr[idx];
    arr[idx] = { id: inP.id, name: inP.name, position: inP.position, side, p: inP, x: out.x, y: out.y, baseX: out.baseX, baseY: out.baseY, condition: 1, run: null, yellow: false };
    subsUsed[side]++;
    // taşıyıcı çıktıysa top yeni girene geçer (index aynı) — güvenli
    emit("sub", side, `Değişiklik: ${inP.name} oyuna girdi, ${out.name} çıktı.`, 2, arr[idx]);
    return { ok: true };
  }

  return {
    step,
    getState: () => st,
    getResult,
    isFinished: () => st.tick >= TOTAL_TICKS,
    substitute,
    subsUsed: (side: Side) => subsUsed[side],
    getFit: (side: Side) => fit[side],
  };
}
