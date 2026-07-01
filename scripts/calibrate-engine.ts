// Motor v2 kalibrasyon kapısı: sentetik kadrolarla yüzlerce maç simüle eder,
// hedefler tutmazsa exit≠0. Çalıştır: npx tsx scripts/calibrate-engine.ts
import { generatePlayer } from "@/lib/player-generator";
import { createLiveEngine } from "@/lib/match-engine/live/engine";
import { STYLE_PRESETS } from "@/lib/tactic-styles";
import type { EngineTeam, SimResult } from "@/lib/match-engine/simulator";
import type { Player, Tactics, TacticStyle } from "@/types/game";

const N = 120;

function squad(boost: string[] = [], tier: "common" | "decent" | "good" = "decent"): Player[] {
  const plan = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW", "DF", "MF", "FW"] as Player["position"][];
  return plan.map((position, i) => {
    const g = generatePlayer({ position, tier });
    const attrs: any = { ...g.attributes };
    for (const k of boost) if (typeof attrs[k] === "number") attrs[k] = Math.min(20, attrs[k] + 5);
    return { id: `p${i}-${Math.random()}`, team_id: "t", name: `P${i}`, age: 25, position, is_youth_academy: false, potential: g.potential, value_cr: 0, for_sale: false, asking_price: null, created_at: "", ...attrs } as unknown as Player;
  });
}

function tac(style: TacticStyle): Tactics {
  const p = STYLE_PRESETS[style].settings;
  return { id: "", team_id: "", formation: "4-3-3", mentality: p.mentality, pressing: p.pressing, tempo: p.tempo, pass_style: p.pass_style, style, advanced: { width: p.width, defensive_line: p.defensive_line, counter_attack: p.counter_attack, time_wasting: p.time_wasting }, lineup: {}, substitutes: [], updated_at: "" } as Tactics;
}

function team(name: string, players: Player[], t: Tactics): EngineTeam {
  return { teamId: name, name, isAi: true, players, tactics: t };
}

interface Agg {
  gh: number; ga: number; sh: number; sa: number; sotH: number; sotA: number;
  possH: number; wH: number; wA: number; draws: number; counters: number;
  condEndH: number;
}

function runSet(mkHome: () => EngineTeam, mkAway: () => EngineTeam, n = N): Agg {
  const agg: Agg = { gh: 0, ga: 0, sh: 0, sa: 0, sotH: 0, sotA: 0, possH: 0, wH: 0, wA: 0, draws: 0, counters: 0, condEndH: 0 };
  for (let i = 0; i < n; i++) {
    const eng = createLiveEngine(mkHome(), mkAway(), "cal" + i);
    while (!eng.isFinished()) eng.step();
    const r: SimResult = eng.getResult();
    const stH = eng.getState().home;
    agg.gh += r.homeScore; agg.ga += r.awayScore;
    agg.sh += r.stats.shotsHome; agg.sa += r.stats.shotsAway;
    agg.sotH += r.stats.sotHome; agg.sotA += r.stats.sotAway;
    agg.possH += r.stats.possessionHome;
    if (r.homeScore > r.awayScore) agg.wH++; else if (r.homeScore < r.awayScore) agg.wA++; else agg.draws++;
    agg.counters += r.events.filter((e) => e.type === "counter").length;
    agg.condEndH += stH.reduce((s, p) => s + p.condition, 0) / stH.length;
  }
  return agg;
}

let failed = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "✅" : "❌"} ${name} — ${detail}`);
  if (!ok) failed++;
}

// 1) Dengeli ayna maç
{
  const a = runSet(() => team("H", squad(), tac("balanced")), () => team("A", squad(), tac("balanced")));
  const gH = a.gh / N, gA = a.ga / N, sH = a.sh / N, sA = a.sa / N;
  const sotPct = (a.sotH + a.sotA) / Math.max(1, a.sh + a.sa);
  check("Gol/takım (dengeli)", gH >= 0.8 && gH <= 1.8 && gA >= 0.6 && gA <= 1.6, `H=${gH.toFixed(2)} A=${gA.toFixed(2)} (hedef ~0.8-1.8)`);
  check("Şut/takım", sH >= 7 && sH <= 16 && sA >= 7 && sA <= 16, `H=${sH.toFixed(1)} A=${sA.toFixed(1)} (hedef 7-16)`);
  check("İsabet oranı", sotPct >= 0.28 && sotPct <= 0.6, `${(sotPct * 100).toFixed(0)}% (hedef 28-60)`);
  check("Possession (ayna)", a.possH / N >= 42 && a.possH / N <= 58, `${(a.possH / N).toFixed(0)}% (hedef 42-58)`);
  check("Ev avantajı", (a.wH - a.wA) / N >= 0.02 && (a.wH - a.wA) / N <= 0.30, `+${(((a.wH - a.wA) / N) * 100).toFixed(0)} puan (hedef +2..+30)`);
}

// 2) Güçlü vs zayıf
{
  const a = runSet(() => team("H", squad([], "good"), tac("balanced")), () => team("A", squad([], "common"), tac("balanced")));
  check("Güç duyarlılığı", a.wH / N >= 0.6, `güçlü galibiyet ${((a.wH / N) * 100).toFixed(0)}% (hedef ≥60)`);
}

// 3) Uyumlu gegenpress vs uyumsuz tiki-taka
{
  const pressSquad = () => squad(["work_rate", "stamina", "teamwork", "aggression", "pace"]);
  const plainSquad = () => squad([]);
  const a = runSet(() => team("H", pressSquad(), tac("gegenpress")), () => team("A", plainSquad(), tac("tiki_taka")));
  check("Uyumlu gegenpress > uyumsuz tiki-taka", a.wH / N >= 0.5, `galibiyet ${((a.wH / N) * 100).toFixed(0)}% (hedef ≥50)`);
}

// 4) Uyumsuz gegenpress yorulur
{
  const a = runSet(() => team("H", squad([], "common"), tac("gegenpress")), () => team("A", squad([], "common"), tac("balanced")));
  check("Uyumsuz gegenpress kondisyonu düşük", a.condEndH / N <= 0.72, `90' ort. kondisyon ${(a.condEndH / N).toFixed(2)} (hedef ≤0.72)`);
}

// 5) Otobüs park etmek şutları keser
{
  const base = runSet(() => team("H", squad(), tac("balanced")), () => team("A", squad(), tac("balanced")), 80);
  const bus = runSet(() => team("H", squad(), tac("balanced")), () => team("A", squad(["positioning", "concentration", "tackling"]), tac("park_bus")), 80);
  const baseGh = base.gh / 80, busGh = bus.gh / 80;
  check("Park-the-bus rakip golünü azaltır", busGh <= baseGh * 0.85, `dengeli rakip ${baseGh.toFixed(2)} gol vs otobüs rakibi ${busGh.toFixed(2)} (hedef ≤%85)`);
}

// 6) Kontra stili geçiş hücumları üretir
{
  const a = runSet(() => team("H", squad(["pace", "acceleration", "off_the_ball"]), tac("counter")), () => team("A", squad(), tac("tiki_taka")));
  check("Kontra olayları", a.counters / N >= 0.8, `maç başına ${(a.counters / N).toFixed(1)} kontra (hedef ≥0.8)`);
}

// 7) Determinizm
{
  const s1 = squad(); const s2 = squad();
  const r1 = (() => { const e = createLiveEngine(team("H", s1, tac("balanced")), team("A", s2, tac("balanced")), "det"); while (!e.isFinished()) e.step(); return e.getResult(); })();
  const r2 = (() => { const e = createLiveEngine(team("H", s1, tac("balanced")), team("A", s2, tac("balanced")), "det"); while (!e.isFinished()) e.step(); return e.getResult(); })();
  check("Determinizm", r1.homeScore === r2.homeScore && r1.awayScore === r2.awayScore && r1.events.length === r2.events.length, `${r1.homeScore}-${r1.awayScore} == ${r2.homeScore}-${r2.awayScore}`);
}

console.log(failed === 0 ? "\n🎉 Kalibrasyon: TÜM HEDEFLER YEŞİL" : `\n💥 Kalibrasyon: ${failed} hedef KIRMIZI`);
process.exit(failed === 0 ? 0 : 1);
