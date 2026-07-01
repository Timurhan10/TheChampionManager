// The Champion Manager — Maç simülasyon motoru
// İki takımın kadro + taktiğinden skor, olaylar ve istatistik üretir.

import { overallRating } from "@/lib/player-generator";
import type { AttributeKey } from "@/lib/attributes";
import type { Player, Tactics, MatchEvent, Position } from "@/types/game";

export interface EngineTeam {
  teamId: string;
  name: string;
  isAi: boolean;
  players: Player[];
  tactics: Tactics | null;
}

export interface SimStats {
  possessionHome: number;
  shotsHome: number;
  shotsAway: number;
  sotHome: number;
  sotAway: number;
  cornersHome: number;
  cornersAway: number;
}

export interface PlayerRating {
  playerId: string;
  name: string;
  team: "home" | "away";
  rating: number; // 0-10
}

export interface SimResult {
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  stats: SimStats;
  manOfTheMatch: { playerId: string; name: string; team: "home" | "away" } | null;
  playerRatings: PlayerRating[];
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function mean(p: Player, keys: AttributeKey[]): number {
  const vals: number[] = [];
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "number") vals.push(v);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 10;
}

// FM'e göre pozisyon-rol özellik havuzları (dengeli).
const OFF_ATTRS: AttributeKey[] = ["shooting", "long_shots", "off_the_ball", "dribbling", "technique", "pace", "composure", "first_touch", "anticipation"];
const DEF_ATTRS: AttributeKey[] = ["tackling", "positioning", "strength", "anticipation", "concentration", "heading", "jumping"];
const GK_ATTRS: AttributeKey[] = ["reflexes", "handling", "one_on_ones", "command_of_area", "positioning"];
const MID_ATTRS: AttributeKey[] = ["passing", "vision", "teamwork", "work_rate", "stamina", "technique", "decisions"];

// Pozisyon ağırlıkları
const ATT_W: Record<Position, number> = { FW: 1.0, MF: 0.55, DF: 0.15, GK: 0 };
const DEF_W: Record<Position, number> = { GK: 1.0, DF: 1.0, MF: 0.4, FW: 0.1 };

function startingEleven(team: EngineTeam): Player[] {
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const lineupIds = team.tactics?.lineup ? Object.values(team.tactics.lineup).filter(Boolean) : [];
  let eleven = (lineupIds as string[]).map((id) => byId.get(id)).filter(Boolean) as Player[];

  if (eleven.length < 11) {
    const chosen = new Set(eleven.map((p) => p.id));
    // En az bir kaleci garanti
    if (!eleven.some((p) => p.position === "GK")) {
      const gk = team.players.find((p) => p.position === "GK" && !chosen.has(p.id));
      if (gk) { eleven.push(gk); chosen.add(gk.id); }
    }
    const rest = team.players
      .filter((p) => !chosen.has(p.id))
      .sort((a, b) => overallRating(b, b.position) - overallRating(a, a.position));
    for (const p of rest) {
      if (eleven.length >= 11) break;
      eleven.push(p);
    }
  }
  return eleven.slice(0, 11);
}

type InstrMap = Record<string, { role?: string; risk?: string; shooting?: string } | undefined>;

// Oyuncu-bazlı rol etkisi (mütevazı)
function roleAttMult(role?: string): number {
  return role === "attacking" ? 1.2 : role === "defensive" ? 0.85 : 1;
}
function roleDefMult(role?: string): number {
  return role === "defensive" ? 1.2 : role === "attacking" ? 0.85 : 1;
}

function teamAttack(eleven: Player[], instr: InstrMap = {}): number {
  let sum = 0, w = 0;
  for (const p of eleven) {
    const weight = ATT_W[p.position] * roleAttMult(instr[p.id]?.role);
    sum += weight * mean(p, OFF_ATTRS);
    w += weight;
  }
  return w ? sum / w : 10;
}

function teamDefense(eleven: Player[], instr: InstrMap = {}): number {
  let sum = 0, w = 0;
  for (const p of eleven) {
    const weight = DEF_W[p.position] * roleDefMult(instr[p.id]?.role);
    const attrs = p.position === "GK" ? GK_ATTRS : DEF_ATTRS;
    sum += weight * mean(p, attrs);
    w += weight;
  }
  return w ? sum / w : 10;
}

function teamMidfield(eleven: Player[]): number {
  const mids = eleven.filter((p) => p.position === "MF");
  const src = mids.length ? mids : eleven;
  return src.reduce((s, p) => s + mean(p, MID_ATTRS), 0) / src.length;
}

function mentalityFactor(t: Tactics | null): { att: number; def: number } {
  switch (t?.mentality) {
    case "attacking": return { att: 1.2, def: 1.1 };   // +%20 gol şansı, +%10 yenilen risk
    case "defensive": return { att: 0.82, def: 0.88 };
    default: return { att: 1.0, def: 1.0 };
  }
}

function pressingBonus(t: Tactics | null): number {
  switch (t?.pressing) {
    case "high": return 1.08;
    case "low": return 0.95;
    default: return 1.0;
  }
}

// Poisson örnekleyici (Knuth)
function poisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function expectedGoals(att: number, oppDef: number, mentAtt: number, press: number, homeAdv: number): number {
  const diff = att - oppDef; // -10..+10 civarı
  let xg = 1.15 + diff * 0.12;
  xg *= mentAtt * press;
  xg += homeAdv;
  return Math.max(0.15, Math.min(4.5, xg));
}

// Gol atan oyuncuyu pozisyon + şut ağırlığıyla seç (oyuncu talimatları etkiler)
function pickScorer(eleven: Player[], instr: InstrMap = {}): Player {
  const posW: Record<Position, number> = { FW: 5, MF: 3, DF: 1, GK: 0 };
  const shootMult = (s?: string) => (s === "often" ? 1.3 : s === "rare" ? 0.7 : 1);
  const weights = eleven.map((p) => posW[p.position] * roleAttMult(instr[p.id]?.role) * shootMult(instr[p.id]?.shooting) * (1 + mean(p, ["shooting", "off_the_ball"]) / 20));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < eleven.length; i++) {
    r -= weights[i];
    if (r <= 0) return eleven[i];
  }
  return eleven[0];
}

export function simulateMatch(home: EngineTeam, away: EngineTeam): SimResult {
  const hEleven = startingEleven(home);
  const aEleven = startingEleven(away);

  const hInstr = (home.tactics?.player_instructions ?? {}) as InstrMap;
  const aInstr = (away.tactics?.player_instructions ?? {}) as InstrMap;

  const hAtt = teamAttack(hEleven, hInstr), hDef = teamDefense(hEleven, hInstr), hMid = teamMidfield(hEleven);
  const aAtt = teamAttack(aEleven, aInstr), aDef = teamDefense(aEleven, aInstr), aMid = teamMidfield(aEleven);

  const hMent = mentalityFactor(home.tactics), aMent = mentalityFactor(away.tactics);
  const hPress = pressingBonus(home.tactics), aPress = pressingBonus(away.tactics);

  const xgHome = expectedGoals(hAtt, aDef * aMent.def, hMent.att, hPress, 0.35);
  const xgAway = expectedGoals(aAtt, hDef * hMent.def, aMent.att, aPress, 0.0);

  let homeScore = poisson(xgHome);
  let awayScore = poisson(xgAway);

  // Olaylar
  const events: MatchEvent[] = [];
  const minutes = new Set<number>();
  function uniqueMinute(): number {
    let m: number;
    do { m = Math.floor(rand(1, 91)); } while (minutes.has(m));
    minutes.add(m);
    return m;
  }

  const goalEvents: MatchEvent[] = [];
  for (let i = 0; i < homeScore; i++) {
    const scorer = pickScorer(hEleven, hInstr);
    goalEvents.push({ minute: uniqueMinute(), type: "goal", team: "home", playerId: scorer.id, playerName: scorer.name, text: `GOL! ${scorer.name} ${home.name} adına fileleri buldu.` });
  }
  for (let i = 0; i < awayScore; i++) {
    const scorer = pickScorer(aEleven, aInstr);
    goalEvents.push({ minute: uniqueMinute(), type: "goal", team: "away", playerId: scorer.id, playerName: scorer.name, text: `GOL! ${scorer.name} ${away.name} adına fileleri buldu.` });
  }

  // Kartlar — yüksek saldırganlık + düşük baskı direnci
  const cardEvents: MatchEvent[] = [];
  for (const [side, eleven, tName] of [["home", hEleven, home.name], ["away", aEleven, away.name]] as const) {
    for (const p of eleven) {
      const aggr = mean(p, ["aggression"]);
      const comp = mean(p, ["composure"]);
      const yellowProb = Math.max(0, (aggr - comp) / 100 + 0.04);
      if (Math.random() < yellowProb) {
        cardEvents.push({ minute: uniqueMinute(), type: "yellow", team: side, playerId: p.id, playerName: p.name, text: `Sarı kart — ${p.name} (${tName}).` });
        if (Math.random() < 0.04) {
          cardEvents.push({ minute: uniqueMinute(), type: "red", team: side, playerId: p.id, playerName: p.name, text: `KIRMIZI KART! ${p.name} (${tName}) oyun dışı.` });
        }
      }
    }
  }

  // Değişiklikler (60-75. dk)
  const subEvents: MatchEvent[] = [];
  for (const [side, team, eleven, tName] of [["home", home, hEleven, home.name], ["away", away, aEleven, away.name]] as const) {
    const subs = (team.tactics?.substitutes ?? []) as string[];
    const byId = new Map(team.players.map((p) => [p.id, p]));
    const onPitch = new Set(eleven.map((p) => p.id));
    let used = 0;
    for (const subId of subs) {
      if (used >= 3) break;
      const inP = byId.get(subId);
      const outP = eleven[eleven.length - 1 - used];
      if (inP && outP && !onPitch.has(subId)) {
        subEvents.push({ minute: Math.floor(rand(60, 76)), type: "sub", team: side, playerId: inP.id, playerName: inP.name, text: `Değişiklik (${tName}): ${inP.name} oyuna girdi, ${outP.name} çıktı.` });
        used++;
      }
    }
  }

  // İstatistikler
  const possHome = Math.round(50 + (hMid - aMid) * 2.2 + rand(-4, 4));
  const possessionHome = Math.max(30, Math.min(70, possHome));
  const shotsHome = Math.max(homeScore, Math.round(xgHome * 3 + rand(0, 4)));
  const shotsAway = Math.max(awayScore, Math.round(xgAway * 3 + rand(0, 4)));
  const sotHome = Math.max(homeScore, Math.round(shotsHome * rand(0.4, 0.6)));
  const sotAway = Math.max(awayScore, Math.round(shotsAway * rand(0.4, 0.6)));

  const stats: SimStats = {
    possessionHome,
    shotsHome, shotsAway, sotHome, sotAway,
    cornersHome: Math.round(rand(2, 9)),
    cornersAway: Math.round(rand(1, 7)),
  };

  // Man of the match — kazanan/golcü ağırlıklı
  let motm: SimResult["manOfTheMatch"] = null;
  const allGoals = goalEvents.filter((e) => e.type === "goal");
  if (allGoals.length > 0) {
    const top = allGoals[Math.floor(Math.random() * allGoals.length)];
    motm = { playerId: top.playerId!, name: top.playerName!, team: top.team };
  } else {
    const winnerEleven = homeScore >= awayScore ? hEleven : aEleven;
    const best = [...winnerEleven].sort((a, b) => overallRating(b, b.position) - overallRating(a, a.position))[0];
    motm = { playerId: best.id, name: best.name, team: homeScore >= awayScore ? "home" : "away" };
  }

  // Olayları dakikaya göre sırala + yarı/maç sonu işaretleri
  const allEvents = [...goalEvents, ...cardEvents, ...subEvents].sort((a, b) => a.minute - b.minute);
  const htHome = goalEvents.filter((e) => e.team === "home" && e.minute <= 45).length;
  const htAway = goalEvents.filter((e) => e.team === "away" && e.minute <= 45).length;

  const withMarkers: MatchEvent[] = [];
  let htInserted = false;
  for (const e of allEvents) {
    if (!htInserted && e.minute > 45) {
      withMarkers.push({ minute: 45, type: "half_time", team: "home", text: `İlk yarı sonu: ${htHome}-${htAway}` });
      htInserted = true;
    }
    withMarkers.push(e);
  }
  if (!htInserted) {
    withMarkers.push({ minute: 45, type: "half_time", team: "home", text: `İlk yarı sonu: ${htHome}-${htAway}` });
  }
  withMarkers.push({ minute: 90, type: "full_time", team: "home", text: `Maç sonu: ${homeScore}-${awayScore}` });

  // Oyuncu reytingleri (0-10)
  const playerRatings: PlayerRating[] = [
    ...ratePlayers(hEleven, "home", homeScore, awayScore, goalEvents, cardEvents),
    ...ratePlayers(aEleven, "away", awayScore, homeScore, goalEvents, cardEvents),
  ];

  return { homeScore, awayScore, events: withMarkers, stats, manOfTheMatch: motm, playerRatings };
}

// Her oyuncuya 0-10 reyting. Baz 6.0; gol, sonuç, kaleci/defans yenilen gol, kart etkiler.
function ratePlayers(
  eleven: Player[],
  side: "home" | "away",
  goalsFor: number,
  goalsAgainst: number,
  goalEvents: MatchEvent[],
  cardEvents: MatchEvent[]
): PlayerRating[] {
  const resultAdj = goalsFor > goalsAgainst ? 0.5 : goalsFor < goalsAgainst ? -0.4 : 0;
  return eleven.map((p) => {
    let r = 6.0 + resultAdj;
    // Gol
    const goals = goalEvents.filter((e) => e.team === side && e.playerId === p.id).length;
    r += goals * 1.1;
    // Kaleci / defans yenilen gol etkisi
    if (p.position === "GK") r += goalsAgainst === 0 ? 0.8 : -0.45 * goalsAgainst;
    else if (p.position === "DF") r += goalsAgainst === 0 ? 0.4 : -0.2 * goalsAgainst;
    else if (p.position === "FW" && goals === 0) r -= 0.2;
    // Kartlar
    const yellow = cardEvents.filter((e) => e.team === side && e.type === "yellow" && e.playerId === p.id).length;
    const red = cardEvents.filter((e) => e.team === side && e.type === "red" && e.playerId === p.id).length;
    r -= yellow * 0.3 + red * 1.5;
    // Küçük rastgelelik + sınır
    r += (Math.random() - 0.5) * 0.6;
    r = Math.max(3.0, Math.min(10, r));
    return { playerId: p.id, name: p.name, team: side, rating: Math.round(r * 10) / 10 };
  });
}
