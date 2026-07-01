// The Champion Manager — Oyuncu attribute tanımları (FM tarzı, 44 attribute)
// Master bağlamdaki attribute listesi ve README'deki Türkçe etiketler.

export type AttributeKey =
  // Teknik (14)
  | "passing"
  | "shooting"
  | "dribbling"
  | "heading"
  | "first_touch"
  | "tackling"
  | "long_shots"
  | "free_kick"
  | "corners"
  | "crossing"
  | "penalty"
  | "long_throw"
  | "technique"
  | "long_balls"
  // Zihinsel (14)
  | "determination"
  | "concentration"
  | "aggression"
  | "bravery"
  | "leadership"
  | "teamwork"
  | "work_rate"
  | "vision"
  | "off_the_ball"
  | "positioning"
  | "decisions"
  | "flair"
  | "anticipation"
  | "composure"
  // Fiziksel (8)
  | "pace"
  | "acceleration"
  | "stamina"
  | "strength"
  | "agility"
  | "balance"
  | "jumping"
  | "natural_fitness"
  // Kaleci (8)
  | "reflexes"
  | "handling"
  | "one_on_ones"
  | "command_of_area"
  | "communication"
  | "rushing_out"
  | "kicking"
  | "throwing";

export type AttributeCategory = "technical" | "mental" | "physical" | "goalkeeping";

export const TECHNICAL_ATTRS: AttributeKey[] = [
  "passing", "shooting", "dribbling", "heading", "first_touch", "tackling",
  "long_shots", "free_kick", "corners", "crossing", "penalty", "long_throw",
  "technique", "long_balls",
];

export const MENTAL_ATTRS: AttributeKey[] = [
  "determination", "concentration", "aggression", "bravery", "leadership",
  "teamwork", "work_rate", "vision", "off_the_ball", "positioning",
  "decisions", "flair", "anticipation", "composure",
];

export const PHYSICAL_ATTRS: AttributeKey[] = [
  "pace", "acceleration", "stamina", "strength", "agility", "balance",
  "jumping", "natural_fitness",
];

export const GOALKEEPING_ATTRS: AttributeKey[] = [
  "reflexes", "handling", "one_on_ones", "command_of_area", "communication",
  "rushing_out", "kicking", "throwing",
];

export const ALL_OUTFIELD_ATTRS: AttributeKey[] = [
  ...TECHNICAL_ATTRS, ...MENTAL_ATTRS, ...PHYSICAL_ATTRS,
];

export const ALL_ATTRS: AttributeKey[] = [...ALL_OUTFIELD_ATTRS, ...GOALKEEPING_ATTRS];

export const CATEGORY_LABELS: Record<AttributeCategory, string> = {
  technical: "Teknik",
  mental: "Zihinsel",
  physical: "Fiziksel",
  goalkeeping: "Kaleci",
};

export const CATEGORY_ATTRS: Record<AttributeCategory, AttributeKey[]> = {
  technical: TECHNICAL_ATTRS,
  mental: MENTAL_ATTRS,
  physical: PHYSICAL_ATTRS,
  goalkeeping: GOALKEEPING_ATTRS,
};

// README'deki Türkçe etiketler
export const ATTR_LABELS: Record<AttributeKey, string> = {
  // Teknik
  passing: "Pas",
  shooting: "Şut",
  dribbling: "Sürüş",
  heading: "Kafa",
  first_touch: "İlk Dokunuş",
  tackling: "Top Çalma",
  long_shots: "Uzak Şut",
  free_kick: "Frikik",
  corners: "Köşe",
  crossing: "Çapraz Top",
  penalty: "Penaltı",
  long_throw: "Uzun Atış",
  technique: "Teknik",
  long_balls: "Uzun Top",
  // Zihinsel
  determination: "Kararlılık",
  concentration: "Konsantrasyon",
  aggression: "Saldırganlık",
  bravery: "Cesaret",
  leadership: "Liderlik",
  teamwork: "Takım Oyunu",
  work_rate: "Çalışkanlık",
  vision: "Vizyon",
  off_the_ball: "Hareketlilik",
  positioning: "Pozisyon",
  decisions: "Karar Alma",
  flair: "Hayal Gücü",
  anticipation: "Öngörü",
  composure: "Baskı Direnci",
  // Fiziksel
  pace: "Hız",
  acceleration: "İvme",
  stamina: "Dayanıklılık",
  strength: "Güç",
  agility: "Çeviklik",
  balance: "Denge",
  jumping: "Zıplama",
  natural_fitness: "Kondisyon",
  // Kaleci
  reflexes: "Refleks",
  handling: "Top Tutma",
  one_on_ones: "1v1",
  command_of_area: "Alan Hakimiyeti",
  communication: "İletişim",
  rushing_out: "Çıkma",
  kicking: "Tekme",
  throwing: "Atış",
};

export const POSITION_LABELS: Record<string, string> = {
  GK: "Kaleci",
  DF: "Defans",
  MF: "Orta Saha",
  FW: "Forvet",
};

// README — Pozisyon renk kodları
export const POSITION_COLORS: Record<string, { color: string; bg: string }> = {
  GK: { color: "#F59E0B", bg: "rgba(245,158,11,0.14)" },
  DF: { color: "#3B82F6", bg: "rgba(59,130,246,0.14)" },
  MF: { color: "#10B981", bg: "rgba(16,185,129,0.14)" },
  FW: { color: "#EF4444", bg: "rgba(239,68,68,0.14)" },
};

// Pazarda/rakip kadroda scout edilmeden VARSAYILAN görünür özellikler (pozisyona göre ~4).
export const DEFAULT_VISIBLE_ATTRS: Record<string, AttributeKey[]> = {
  GK: ["reflexes", "handling", "command_of_area", "jumping"],
  DF: ["tackling", "positioning", "strength", "heading"],
  MF: ["passing", "vision", "stamina", "work_rate"],
  FW: ["shooting", "pace", "off_the_ball", "dribbling"],
};

export function defaultVisibleAttrs(position: string): AttributeKey[] {
  return DEFAULT_VISIBLE_ATTRS[position] ?? DEFAULT_VISIBLE_ATTRS.MF;
}

// FM'e göre pozisyonun ÖNE ÇIKAN (anahtar) özellikleri — tek kaynak.
// Üretim eğilimi, pozisyon-ağırlıklı genel puan ve UI vurgusu bunu kullanır.
export const KEY_ATTRS: Record<string, AttributeKey[]> = {
  GK: ["reflexes", "handling", "one_on_ones", "command_of_area", "positioning", "concentration", "anticipation"],
  DF: ["tackling", "positioning", "heading", "strength", "jumping", "anticipation", "composure", "concentration"],
  MF: ["passing", "vision", "stamina", "work_rate", "technique", "teamwork", "decisions", "first_touch"],
  FW: ["shooting", "off_the_ball", "composure", "anticipation", "first_touch", "pace", "dribbling", "long_shots"],
};

export function keyAttrs(position: string): AttributeKey[] {
  return KEY_ATTRS[position] ?? KEY_ATTRS.MF;
}

// Attribute / rating renk eşikleri (1-20 skala)
export function ratingColor(value: number | null | undefined): string {
  if (value == null) return "#475A73";
  if (value <= 7) return "#EF4444";
  if (value <= 13) return "#F59E0B";
  return "#10B981";
}
