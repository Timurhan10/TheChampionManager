// Taktik + uyumdan motor çarpanları (Motor v2). Hem canlı motor hem anlık sim
// aynı çarpanları kullanır → iki motor tutarlı; taktik-kadro uyumu KAZANDIRIR.
import type { Player, Tactics } from "@/types/game";
import type { FitResult } from "./fit";
import { resolveStyle } from "./fit";

export interface TeamModifiers {
  xgMult: number;        // kendi hücum üretimi çarpanı
  oppXgMult: number;     // rakip şans kalitesi çarpanı (savunmacı stiller <1)
  passBonus: number;     // pas başarı olasılığına delta (-0.08..+0.08)
  pressIntensity: number;// baskı yoğunluğu (0.8..1.4)
  counterBoost: number;  // geçiş anındaki şut çarpanı (0.7..1.4)
  drainMult: number;     // kondisyon düşüş çarpanı (0.9..1.7)
  decisionMult: number;  // karar süresi çarpanı (hızlı 0.75 / yavaş 1.3)
  lineHeight: number;    // savunma hattı yüksekliği (kendi kalesinden, 0.20/0.30/0.40)
  widthScale: number;    // hücum genişliği (0.8/1.0/1.15)
  possessionBias: number;// topu tutma eğilimi (-1..+1)
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function dfPaceMean(players: Player[] | null): number {
  if (!players) return 11;
  const df = players.filter((p) => p.position === "DF");
  if (!df.length) return 11;
  let s = 0, n = 0;
  for (const p of df) for (const k of ["pace", "acceleration"]) {
    const v = (p as any)[k];
    if (typeof v === "number") { s += v; n++; }
  }
  return n ? s / n : 11;
}

export function computeModifiers(t: Tactics | null, fit: FitResult, players: Player[] | null = null): TeamModifiers {
  const style = resolveStyle(t);
  const f = clamp((fit.score - 50) / 50, -1, 1); // -1..+1
  const fp = Math.max(0, f), fn = Math.max(0, -f);
  const adv = t?.advanced ?? {};

  // xG çarpanı: stiline uyumluysan ödül, değilsen ceza
  const BP: Record<string, [number, number]> = {
    gegenpress: [0.18, 0.12], tiki_taka: [0.15, 0.15], direct: [0.10, 0.18],
    wing_play: [0.12, 0.12], counter: [0.06, 0.06], balanced: [0.06, 0.06],
    park_bus: [0, 0],
  };
  let xgMult = style === "park_bus" ? 0.60 : 1 + BP[style][0] * fp - BP[style][1] * fn;

  // Rakip xG çarpanı: savunmacı düzenler rakibi keser; uyumsuz gegenpress arkada boşluk verir
  let oppXgMult = 1;
  if (style === "park_bus") oppXgMult = 1 - (0.22 + 0.13 * fp); // uyumlu 0.65, uyumsuz 0.85
  else if (style === "gegenpress") oppXgMult = 0.92 - 0.04 * fp + 0.20 * fn;
  else if (style === "counter") oppXgMult = 0.92 - 0.04 * fp;
  if (adv.defensive_line === "high" && dfPaceMean(players) < 11) oppXgMult += 0.10; // hızsız stoper + yüksek hat = kontra yem
  if (adv.defensive_line === "low") oppXgMult -= 0.04;

  // Pas bonusu
  let passBonus = 0;
  if (style === "tiki_taka" || t?.pass_style === "short") passBonus += 0.05 * f;
  if (t?.tempo === "fast") passBonus -= 0.04 * fn;

  const pressIntensity = clamp(
    (t?.pressing === "high" ? 1.2 : t?.pressing === "low" ? 0.85 : 1) + (style === "gegenpress" ? 0.15 * fp : 0),
    0.8, 1.4,
  );

  const counterBoost = style === "counter"
    ? clamp(1 + 0.35 * fp - 0.25 * fn, 0.7, 1.4)
    : adv.counter_attack ? 1 + 0.15 * fp : 1;

  const drainMult = clamp(
    1 + (t?.pressing === "high" ? 0.25 : 0) + (t?.tempo === "fast" ? 0.10 : 0)
      + (style === "gegenpress" ? 0.5 * fn : 0) - (style === "park_bus" ? 0.1 : 0),
    0.9, 1.7,
  );

  const decisionMult = t?.tempo === "fast" ? 0.75 : t?.tempo === "slow" ? 1.3 : 1;
  const lineHeight = adv.defensive_line === "high" ? 0.40 : adv.defensive_line === "low" ? 0.20 : 0.30;
  const widthScale = adv.width === "wide" ? 1.15 : adv.width === "narrow" ? 0.8 : 1.0;
  const possessionBias = style === "tiki_taka" ? 0.5 + 0.5 * fp : style === "park_bus" || style === "counter" ? -0.5 : 0;

  return {
    xgMult: clamp(xgMult, 0.5, 1.3),
    oppXgMult: clamp(oppXgMult, 0.6, 1.25),
    passBonus: clamp(passBonus, -0.08, 0.08),
    pressIntensity, counterBoost, drainMult, decisionMult, lineHeight, widthScale,
    possessionBias: clamp(possessionBias, -1, 1),
  };
}
