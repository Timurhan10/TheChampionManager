// The Champion Manager — Canlı (tick-tabanlı) maç motoru
// Oyuncu özellikleri + taktik + maç durumundan karar üretir, aksiyonu çözer ve
// MatchEvent akıtır. Tarayıcıda çalışır; sunucu sonucu doğrular/kaydeder.
// Koordinat: x,y ∈ [0,1], YATAY saha. x = uzunluk (kaleler x=0 sol / x=1 sağ),
// y = genişlik. Ev sahibi sağa (x→1) hücum eder, deplasman sola (x→0).

import type { Player, Tactics, MatchEvent } from "@/types/game";
import type { EngineTeam, SimResult, SimStats, PlayerRating } from "../simulator";
import { startingEleven } from "../simulator";
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
  stamina: number;
}
export interface BallState {
  x: number; y: number;
  inFlight: boolean; fromX: number; fromY: number; toX: number; toY: number;
  t: number; dur: number; mode: "pass" | "shot" | "loose";
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
}

// Taktikten davranış çarpanları
function mentalityShot(t: Tactics | null): number {
  return t?.mentality === "attacking" ? 1.25 : t?.mentality === "defensive" ? 0.8 : 1;
}
function pressFactor(t: Tactics | null): number {
  return t?.pressing === "high" ? 1.2 : t?.pressing === "low" ? 0.85 : 1;
}
function passRisk(t: Tactics | null): number {
  return t?.pass_style === "long" ? 1.2 : t?.pass_style === "short" ? 0.85 : 1;
}

const OPP_GOAL_X: Record<Side, number> = { home: 1, away: 0 };

function buildSide(team: EngineTeam, side: Side): LivePlayer[] {
  const eleven = startingEleven(team);
  const base = basePositions(team.tactics?.formation ?? "4-4-2", side);
  return eleven.map((p, i) => {
    const b = base[i] ?? { x: side === "home" ? 0.2 : 0.8, y: 0.5 };
    return { id: p.id, name: p.name, position: p.position, side, p, x: b.x, y: b.y, baseX: b.x, baseY: b.y, stamina: 1 };
  });
}

export interface LiveEngine {
  step: () => void;
  getState: () => LiveState;
  getResult: () => SimResult;
  isFinished: () => boolean;
  substitute: (side: Side, outId: string, inId: string) => { ok: boolean; reason?: string };
  subsUsed: (side: Side) => number;
}

export function createLiveEngine(home: EngineTeam, away: EngineTeam, seedStr: string): LiveEngine {
  const rng = createRng(hashSeed(seedStr));
  const st: LiveState = {
    tick: 0, clockMinute: 0, homeScore: 0, awayScore: 0,
    possession: rng() < 0.5 ? "home" : "away", carrier: 8,
    ball: { x: 0.5, y: 0.5, inFlight: false, fromX: 0.5, fromY: 0.5, toX: 0.5, toY: 0.5, t: 0, dur: 1, mode: "loose" },
    home: buildSide(home, "home"), away: buildSide(away, "away"),
    events: [], lastEvent: null,
    stats: { shotsHome: 0, shotsAway: 0, sotHome: 0, sotAway: 0, possHomeTicks: 0, cornersHome: 0, cornersAway: 0 },
  };
  const tactics: Record<Side, Tactics | null> = { home: home.tactics, away: away.tactics };
  const teamName: Record<Side, string> = { home: home.name, away: away.name };
  const squads: Record<Side, Player[]> = { home: home.players, away: away.players };
  const subsUsed: Record<Side, number> = { home: 0, away: 0 };
  let holdTicks = 0;
  let decisionIn = 6;
  // gecikmeli geçişler (top uçuşu bitince uygulanır)
  let pendingCarrier = -1;
  let pendingTurnover: MatchEvent["type"] | null = null;
  let pendingTurnoverBy: LivePlayer | undefined;
  let pendingKickoffTo: Side | null = null;

  const sideArr = (s: Side) => (s === "home" ? st.home : st.away);
  const carrierP = () => sideArr(st.possession)[st.carrier];

  // Takım gücü + beklenen gol (xG) — golü buna bağlayarak sonucu gerçekçi/güç-duyarlı tutar.
  const OFF = ["shooting", "long_shots", "off_the_ball", "dribbling", "technique", "pace", "composure", "first_touch"];
  const DEF = ["tackling", "positioning", "strength", "anticipation", "concentration", "heading", "jumping"];
  const GKA = ["reflexes", "handling", "one_on_ones", "command_of_area", "positioning"];
  const teamAtt = (s: Side) => { const arr = sideArr(s); let sum = 0, w = 0; for (const pl of arr) { const wt = pl.position === "FW" ? 1 : pl.position === "MF" ? 0.55 : pl.position === "DF" ? 0.15 : 0; sum += wt * mean(pl.p, OFF); w += wt; } return w ? sum / w : 10; };
  const teamDef = (s: Side) => { const arr = sideArr(s); let sum = 0, w = 0; for (const pl of arr) { const wt = pl.position === "GK" ? 1 : pl.position === "DF" ? 1 : pl.position === "MF" ? 0.4 : 0.1; sum += wt * mean(pl.p, pl.position === "GK" ? GKA : DEF); w += wt; } return w ? sum / w : 10; };
  const mentA = (t: Tactics | null) => t?.mentality === "attacking" ? 1.2 : t?.mentality === "defensive" ? 0.82 : 1;
  const mentD = (t: Tactics | null) => t?.mentality === "attacking" ? 1.1 : t?.mentality === "defensive" ? 0.88 : 1;
  const xgCalc = (att: number, oppDef: number, mA: number, press: number, home: number) => clamp((1.15 + (att - oppDef) * 0.12) * mA * press + home, 0.35, 3.2);
  const xgOf: Record<Side, number> = {
    home: xgCalc(teamAtt("home"), teamDef("away") * mentD(tactics.away), mentA(tactics.home), pressFactor(tactics.home), 0.3),
    away: xgCalc(teamAtt("away"), teamDef("home") * mentD(tactics.home), mentA(tactics.away), pressFactor(tactics.away), 0.0),
  };
  const lastShot: Record<Side, number> = { home: -999, away: -999 };
  const SHOT_COOLDOWN = 200;

  function emit(type: MatchEvent["type"], side: Side, text: string, importance = 0, player?: LivePlayer) {
    const ev: MatchEvent = { minute: Math.max(1, Math.round(st.clockMinute)), type, team: side, text, importance, playerId: player?.id, playerName: player?.name };
    st.events.push(ev);
    st.lastEvent = ev;
  }

  // Topa en yakın rakip (savunan taraf)
  function nearestOpponent(toSide: Side, x: number, y: number): { pl: LivePlayer; d: number } {
    const arr = sideArr(toSide === "home" ? "away" : "home");
    let best = arr[0], bd = Infinity;
    for (const pl of arr) { const d = dist(pl.x, pl.y, x, y); if (d < bd) { bd = d; best = pl; } }
    return { pl: best, d: bd };
  }

  function setBallFlight(toX: number, toY: number, mode: BallState["mode"], speedTicks: number) {
    const b = st.ball;
    b.fromX = b.x; b.fromY = b.y; b.toX = toX; b.toY = toY; b.t = 0; b.dur = Math.max(2, speedTicks); b.inFlight = true; b.mode = mode;
  }

  function turnover(reason: MatchEvent["type"], byPlayer?: LivePlayer) {
    const opp: Side = st.possession === "home" ? "away" : "home";
    if (reason === "tackle") emit("tackle", opp, `${byPlayer?.name ?? "Savunma"} topu kazandı.`, 1, byPlayer);
    st.possession = opp;
    // yeni taşıyıcı: topa en yakın (yeni) sahip takım oyuncusu
    const arr = sideArr(opp);
    let best = 0, bd = Infinity;
    for (let i = 0; i < arr.length; i++) { const d = dist(arr[i].x, arr[i].y, st.ball.x, st.ball.y); if (d < bd) { bd = d; best = i; } }
    st.carrier = best;
    st.ball.inFlight = false;
    holdTicks = 0; decisionIn = 11 + Math.floor(rng() * 10);
  }

  function kickoff(toSide: Side) {
    st.possession = toSide;
    st.carrier = 8; // orta saha
    const c = sideArr(toSide)[st.carrier];
    st.ball.x = 0.5; st.ball.y = 0.5; st.ball.inFlight = false; st.ball.mode = "loose";
    if (c) { c.x = 0.5; c.y = 0.5; }
    holdTicks = 0; decisionIn = 6;
  }

  // Pas hedefi: ileri + açık bir eş seç
  function choosePassTarget(carrier: LivePlayer): number {
    const arr = sideArr(st.possession);
    const goalX = OPP_GOAL_X[st.possession];
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < arr.length; i++) {
      if (i === st.carrier) continue;
      const tm = arr[i];
      const forward = (Math.abs(tm.x - goalX) < Math.abs(carrier.x - goalX)) ? 1 : 0; // hedefe daha yakın mı
      const opp = nearestOpponent(st.possession, tm.x, tm.y).d; // açıklık
      const d = dist(carrier.x, carrier.y, tm.x, tm.y);
      const score = forward * 1.4 + opp * 2.0 - d * 1.2 + rng() * 0.5;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best >= 0 ? best : (st.carrier + 1) % arr.length;
  }

  function decide(carrier: LivePlayer) {
    const goalX = OPP_GOAL_X[st.possession];
    const dGoal = Math.abs(carrier.x - goalX);
    const pressure = nearestOpponent(st.possession, carrier.x, carrier.y).d; // küçük = baskı
    const t = tactics[st.possession];

    // Şut eğilimi (yalnız hücum üçlüsünde anlamlı)
    const shootRange = 0.3;
    const inRange = dGoal < shootRange && Math.abs(carrier.y - 0.5) < 0.26;
    const shootScore = inRange
      ? (A(carrier.p, "shooting") + A(carrier.p, "composure") + A(carrier.p, "technique")) / 3 * mentalityShot(t)
        * (1 - dGoal / shootRange) + rng() * 5
      : -1;
    const passScore = (A(carrier.p, "passing") + A(carrier.p, "vision") + A(carrier.p, "decisions")) / 3
      + (pressure < 0.08 ? -2 : 5) + rng() * 3;

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
    const skill = (A(carrier.p, "passing") + A(carrier.p, "technique") + A(carrier.p, "decisions")) / 3;
    // başarı olasılığı
    let prob = 0.55 + (skill - 10) * 0.03 - d * 0.35 - (pressure < 0.07 ? 0.15 : 0) - (passRisk(t) - 1) * 0.15;
    prob = clamp(prob, 0.35, 0.95);
    if (rng() < prob) {
      setBallFlight(target.x, target.y, "pass", Math.round(4 + d * 20));
      // pas sonrası taşıyıcı hedefe geçecek (topa varınca)
      pendingCarrier = targetIdx;
    } else {
      // araya girildi
      const opp = nearestOpponent(st.possession, target.x, target.y);
      setBallFlight(opp.pl.x, opp.pl.y, "loose", Math.round(4 + d * 18));
      pendingTurnover = "tackle"; pendingTurnoverBy = opp.pl;
    }
    holdTicks = 0; decisionIn = 11 + Math.floor(rng() * 10);
  }

  function resolveShot(shooter: LivePlayer) {
    const side = st.possession;
    const goalX = OPP_GOAL_X[side];
    const dGoal = Math.abs(shooter.x - goalX);
    const pressure = nearestOpponent(side, shooter.x, shooter.y).d;
    const gk = sideArr(side === "home" ? "away" : "home")[0]; // rakip kaleci (index 0)
    if (side === "home") st.stats.shotsHome++; else st.stats.shotsAway++;
    lastShot[side] = st.tick;
    emit("shot", side, `${shooter.name} şutunu çekti!`, 1, shooter);

    const quality = (A(shooter.p, "shooting") * 1.2 + A(shooter.p, "composure") + A(shooter.p, "technique")) / 3.2
      * (1 - dGoal / 0.5) - (pressure < 0.06 ? 3 : 0) + rng() * 4;

    // top kaleye doğru uçsun (görsel)
    setBallFlight(goalX, 0.5, "shot", 4);

    const onTarget = quality > 4 && rng() < clamp(0.32 + (quality - 9) * 0.04, 0.2, 0.62);
    if (!onTarget) {
      emit("miss", side, `${shooter.name}'in şutu az farkla dışarı.`, 0, shooter);
      pendingKickoffTo = side === "home" ? "away" : "home"; // kale vuruşu
      return;
    }
    if (side === "home") st.stats.sotHome++; else st.stats.sotAway++;
    // Gol olasılığı takım gücüne (xG) bağlı — şut kalitesiyle hafif modüle edilir.
    const goalProb = clamp(xgOf[side] / 8.5, 0.05, 0.38) * clamp(quality / 9, 0.65, 1.5);
    if (rng() < goalProb) {
      if (side === "home") st.homeScore++; else st.awayScore++;
      emit("goal", side, `GOL! ${shooter.name} ${teamName[side]} adına fileleri buldu.`, 3, shooter);
      pendingKickoffTo = side === "home" ? "away" : "home";
    } else {
      emit("save", side === "home" ? "away" : "home", `${gk.name} müthiş kurtardı!`, 2, gk);
      pendingKickoffTo = side === "home" ? "away" : "home";
    }
  }

  function roleFactor(pos: Player["position"]): number {
    return pos === "FW" ? 1 : pos === "MF" ? 0.6 : pos === "DF" ? 0.3 : 0;
  }

  function movePlayers() {
    for (const s of ["home", "away"] as Side[]) {
      const arr = sideArr(s);
      const attacking = s === st.possession;
      const goalDir = s === "home" ? 1 : -1; // hücum yönü (ev sahibi sağa, x→1)
      const ownDir = -goalDir;
      const t = tactics[s];
      const mentMult = t?.mentality === "attacking" ? 1.2 : t?.mentality === "defensive" ? 0.7 : 1;
      // savunmada topa en yakın (kaleci hariç)
      let near = 1, nd = Infinity;
      for (let i = 1; i < arr.length; i++) { const d = dist(arr[i].x, arr[i].y, st.ball.x, st.ball.y); if (d < nd) { nd = d; near = i; } }

      for (let i = 0; i < arr.length; i++) {
        const pl = arr[i];
        let tx = pl.baseX, ty = pl.baseY;
        const rf = roleFactor(pl.position);
        if (i === 0) {
          ty = pl.baseY + (st.ball.y - pl.baseY) * 0.04; // kaleci genişlikte topu izler
        } else if (attacking && i === st.carrier) {
          // top taşıyıcı: rakip kaleye doğru YAVAŞ ilerle, hafif merkeze
          tx = pl.x + goalDir * 0.10;
          ty = 0.5 + (pl.y - 0.5) * 0.94;
        } else if (attacking) {
          const shift = 0.40 * rf * mentMult;
          tx = pl.baseX + goalDir * shift;
          ty = pl.baseY + (0.5 - pl.baseY) * 0.12;
        } else if (i === near) {
          tx = st.ball.x; ty = st.ball.y; // baskı
        } else {
          const shift = 0.08 * (1 + rf * 0.3) * pressFactor(t);
          tx = pl.baseX + ownDir * shift;
          ty = pl.baseY + (st.ball.y - pl.baseY) * 0.12;
        }
        tx = clamp(tx, 0.02, 0.98); ty = clamp(ty, 0.03, 0.97);
        let spd = 0.02 + A(pl.p, "pace", 10) / 20 * 0.03 * pl.stamina;
        if (attacking && i === st.carrier) spd *= 0.55; // taşıyıcı sürüşü yavaş
        pl.x += clamp(tx - pl.x, -spd, spd);
        pl.y += clamp(ty - pl.y, -spd, spd);
      }
    }
    if (!st.ball.inFlight) { const c = carrierP(); if (c) { st.ball.x = c.x; st.ball.y = c.y; } }
  }

  function step() {
    if (st.tick >= TOTAL_TICKS) return;
    st.tick++;
    st.clockMinute = (st.tick / TOTAL_TICKS) * 90;
    if (st.possession === "home") st.stats.possHomeTicks++;

    // top uçuşu
    if (st.ball.inFlight) {
      const b = st.ball;
      b.t++;
      const k = clamp(b.t / b.dur, 0, 1);
      b.x = b.fromX + (b.toX - b.fromX) * k;
      b.y = b.fromY + (b.toY - b.fromY) * k;
      if (k >= 1) {
        b.inFlight = false;
        if (pendingKickoffTo) { const to = pendingKickoffTo; pendingKickoffTo = null; kickoff(to); }
        else if (pendingTurnover) { pendingTurnover = null; turnover("tackle", pendingTurnoverBy); pendingTurnoverBy = undefined; }
        else if (pendingCarrier >= 0) { st.carrier = pendingCarrier; pendingCarrier = -1; const c = carrierP(); if (c) { st.ball.x = c.x; st.ball.y = c.y; } }
      }
    } else {
      // taşıyıcı topta: baskı ve karar
      holdTicks++;
      const c = carrierP();
      if (c) {
        // rakip baskısı → top kapma denemesi
        const near = nearestOpponent(st.possession, c.x, c.y);
        const t = tactics[st.possession === "home" ? "away" : "home"];
        if (near.d < 0.05) {
          const tackle = (A(near.pl.p, "tackling") + A(near.pl.p, "positioning") + A(near.pl.p, "strength") + A(near.pl.p, "aggression")) / 4 * pressFactor(t);
          const evade = (A(c.p, "dribbling") + A(c.p, "agility", 10) + A(c.p, "technique")) / 3;
          const pTackle = clamp(0.10 + (tackle - evade) * 0.02, 0.02, 0.42);
          if (rng() < pTackle) { turnover("tackle", near.pl); }
        }
        if (holdTicks >= decisionIn && !st.ball.inFlight) { decide(c); }
      }
    }

    movePlayers();

    // stamina yavaş düşüş
    if (st.tick % 30 === 0) {
      for (const s of ["home", "away"] as Side[]) for (const pl of sideArr(s)) pl.stamina = clamp(pl.stamina - (100 - A(pl.p, "natural_fitness", 10) - A(pl.p, "stamina", 10)) * 0.00008, 0.55, 1);
    }
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
        r += (rng() - 0.5) * 0.5;
        out.push({ playerId: pl.id, name: pl.name, team: s, rating: Math.round(clamp(r, 3, 10) * 10) / 10 });
      }
    }
    return out;
  }

  function getResult(): SimResult {
    const events = [...st.events];
    // yarı/maç sonu işaretleri
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
    arr[idx] = { id: inP.id, name: inP.name, position: inP.position, side, p: inP, x: out.x, y: out.y, baseX: out.baseX, baseY: out.baseY, stamina: 1 };
    subsUsed[side]++;
    emit("sub", side, `Değişiklik: ${inP.name} oyuna girdi, ${out.name} çıktı.`, 1, arr[idx]);
    return { ok: true };
  }

  return {
    step,
    getState: () => st,
    getResult,
    isFinished: () => st.tick >= TOTAL_TICKS,
    substitute,
    subsUsed: (side: Side) => subsUsed[side],
  };
}
