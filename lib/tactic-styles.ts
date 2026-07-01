// Taktik stilleri (Motor v2): 7 hazır stil, ayar demetleri ve AI için kadroya
// en uygun stil seçimi. Stil seçmek ayarları uygular; kullanıcı üzerine ince ayar yapabilir.
import type { Player, TacticStyle, TacticAdvanced } from "@/types/game";

export interface StylePreset {
  label: string;
  desc: string;
  settings: {
    mentality: string;
    pressing: string;
    tempo: string;
    pass_style: string;
  } & TacticAdvanced;
}

export const STYLE_PRESETS: Record<TacticStyle, StylePreset> = {
  gegenpress: {
    label: "Yüksek Baskı (Gegenpress)",
    desc: "Topu kaybedince anında geri kazan. Çalışkanlık, dayanıklılık ve hız ister.",
    settings: { mentality: "attacking", pressing: "high", tempo: "fast", pass_style: "short", defensive_line: "high", width: "normal" },
  },
  tiki_taka: {
    label: "Kısa Pas (Tiki-Taka)",
    desc: "Topa sahip ol, sabırla boşluk yarat. Pas, teknik ve vizyon ister.",
    settings: { mentality: "balanced", pressing: "medium", tempo: "slow", pass_style: "short", defensive_line: "high", width: "wide" },
  },
  counter: {
    label: "Kontra Atak",
    desc: "Blokta bekle, top kazanınca şimşek gibi çık. Hızlı hücumcular ister.",
    settings: { mentality: "balanced", pressing: "low", tempo: "fast", pass_style: "mixed", defensive_line: "low", width: "normal", counter_attack: true },
  },
  direct: {
    label: "Uzun Top (Direkt)",
    desc: "Uzun toplarla hedef adama oyna. Güçlü, kafası iyi forvet ister.",
    settings: { mentality: "balanced", pressing: "medium", tempo: "normal", pass_style: "long", defensive_line: "medium", width: "normal" },
  },
  wing_play: {
    label: "Kanat Oyunu",
    desc: "Kanatlardan ortala. Hızlı, orta açan kanatlar + kafası iyi forvet ister.",
    settings: { mentality: "balanced", pressing: "medium", tempo: "normal", pass_style: "mixed", defensive_line: "medium", width: "wide" },
  },
  park_bus: {
    label: "Otobüsü Park Et",
    desc: "Alçak blok, az risk. Pozisyon bilen, konsantre savunmacılar ister.",
    settings: { mentality: "defensive", pressing: "low", tempo: "slow", pass_style: "long", defensive_line: "low", width: "narrow", time_wasting: true },
  },
  balanced: {
    label: "Dengeli",
    desc: "Her duruma uyumlu, nötr yaklaşım.",
    settings: { mentality: "balanced", pressing: "medium", tempo: "normal", pass_style: "mixed", defensive_line: "medium", width: "normal" },
  },
};

export const ALL_STYLES = Object.keys(STYLE_PRESETS) as TacticStyle[];

// --- AI: kadroya en uygun stili seç ---
function avg(players: Player[], keys: string[]): number {
  let s = 0, n = 0;
  for (const p of players) for (const k of keys) {
    const v = (p as any)[k];
    if (typeof v === "number") { s += v; n++; }
  }
  return n ? s / n : 10;
}

export function pickBestStyleForSquad(players: Player[]): TacticStyle {
  const out = players.filter((p) => p.position !== "GK");
  const fw = players.filter((p) => p.position === "FW");
  const df = players.filter((p) => p.position === "DF");
  const mf = players.filter((p) => p.position === "MF");

  const scores: Record<TacticStyle, number> = {
    gegenpress: avg(out, ["work_rate", "stamina", "aggression", "pace"]),
    tiki_taka: avg(out, ["passing", "technique", "first_touch"]) * 0.6 + avg(mf, ["vision", "composure"]) * 0.4,
    counter: avg(fw, ["pace", "acceleration", "off_the_ball"]),
    direct: avg(fw, ["strength", "heading", "jumping"]) * 0.7 + avg(df, ["long_balls"]) * 0.3,
    wing_play: avg(out, ["crossing", "pace", "dribbling"]),
    park_bus: avg(df, ["positioning", "concentration", "tackling"]),
    balanced: 11, // nötr taban — hiçbir profil öne çıkmıyorsa
  };

  let best: TacticStyle = "balanced", bestV = -Infinity;
  for (const s of ALL_STYLES) {
    if (scores[s] > bestV) { bestV = scores[s]; best = s; }
  }
  return best;
}
