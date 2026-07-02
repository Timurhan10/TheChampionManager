// The Champion Manager — Oyuncu üretim mantığı
// Master bağlam: tüm attribute'lar 8-12 random, potansiyel yaşa göre, değer hesabı.

import {
  ALL_OUTFIELD_ATTRS,
  GOALKEEPING_ATTRS,
  MENTAL_ATTRS,
  PHYSICAL_ATTRS,
  keyAttrs,
  type AttributeKey,
} from "./attributes";
import { countryByKey, randomCountry, countryPlayerName } from "./countries";
import type { Position } from "@/types/game";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- İsim üretici (Türkçe + uluslararası karışım) ---
const FIRST_NAMES = [
  "Kerim", "Murat", "Emre", "Burak", "Arda", "Cengiz", "Hakan", "Yusuf",
  "Mehmet", "Ali", "Can", "Deniz", "Berke", "Onur", "Tolga", "Serkan",
  "Lucas", "Mateo", "Diego", "Marco", "Luka", "Kai", "Noah", "Liam",
  "Mohamed", "Karim", "Youssef", "Amadou", "Sadio", "Victor", "Andre",
  "Ivan", "Nikola", "Stefan", "Jonas", "Felix", "Hugo", "Leon", "Erik",
];

const LAST_NAMES = [
  "Demir", "Yılmaz", "Kaya", "Çelik", "Şahin", "Yıldız", "Aydın", "Öztürk",
  "Arslan", "Doğan", "Koç", "Kurt", "Aksoy", "Polat", "Erdoğan", "Güneş",
  "Silva", "Santos", "Rossi", "Müller", "Schmidt", "Kovac", "Novak",
  "Diallo", "Traore", "Mendes", "Costa", "Andersson", "Nielsen", "Bauer",
  "Ferrari", "Romano", "Petrov", "Ivanov", "Hansen", "Larsen", "Weber",
];

export function generatePlayerName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

// Yaşa göre potansiyel aralığı (master bağlam)
function potentialForAge(age: number): number {
  if (age <= 19) return randInt(14, 20);
  if (age <= 24) return randInt(10, 16);
  if (age <= 29) return randInt(8, 13);
  return randInt(5, 10);
}

export interface GeneratedPlayer {
  name: string;
  age: number;
  position: Position;
  potential: number;
  value_cr: number;
  is_youth_academy: boolean;
  country: string;
  attributes: Record<string, number | null>;
}

export interface GenerateOptions {
  name?: string;
  age?: number;
  position: Position;
  isYouth?: boolean;
  country?: string; // ülke anahtarı (ör. "BR"); verilmezse rastgele
  // Attribute üretim aralığı (varsayılan 8-12; AI takımları 8-14 kullanabilir)
  attrMin?: number;
  attrMax?: number;
  // Kalite katmanı verilirse attrMin/attrMax ondan gelir (transfer/serbest oyuncular).
  tier?: QualityTier;
}

// --- Kalite katmanları (Model A — Dengeli): %55 / %28 / %12 / %5 ---
export type QualityTier = "common" | "decent" | "good" | "elite";

const TIER_RANGES: Record<QualityTier, [number, number]> = {
  common: [7, 11],
  decent: [10, 13],
  good: [12, 15],
  elite: [14, 18],
};

export function rollQualityTier(): QualityTier {
  const r = Math.random() * 100;
  if (r < 55) return "common";
  if (r < 83) return "decent"; // 55 + 28
  if (r < 95) return "good"; // + 12
  return "elite"; // + 5
}

export function generatePlayer(opts: GenerateOptions): GeneratedPlayer {
  const position = opts.position;
  const isYouth = opts.isYouth ?? false;
  const age = opts.age ?? (isYouth ? randInt(16, 19) : randInt(18, 33));
  const [tierMin, tierMax] = opts.tier ? TIER_RANGES[opts.tier] : [undefined, undefined];
  const attrMin = opts.attrMin ?? tierMin ?? 8;
  const attrMax = opts.attrMax ?? tierMax ?? 12;

  const attributes: Record<string, number | null> = {};

  // Saha oyuncusu attribute'ları
  for (const key of ALL_OUTFIELD_ATTRS) {
    attributes[key] = randInt(attrMin, attrMax);
  }

  // Kaleci attribute'ları — sadece GK doldurur, diğerleri null
  for (const key of GOALKEEPING_ATTRS) {
    attributes[key] = position === "GK" ? randInt(attrMin, attrMax) : null;
  }

  // Pozisyona uygun hafif eğilim (GK refleks vb. zaten dolu; FW şut, DF top çalma)
  applyPositionBias(attributes, position, attrMax);

  // Ülke eğilimi (ülkenin öne çıkan özelliklerini hafif yükselt)
  const country = countryByKey(opts.country) ?? randomCountry();
  for (const key of country.bias) bump(attributes, key, 2, attrMax);

  const potential = potentialForAge(age);
  const value_cr = computeValue(attributes, position, age, potential);

  return {
    name: opts.name ?? countryPlayerName(country),
    age,
    position,
    potential,
    value_cr,
    is_youth_academy: isYouth,
    country: country.key,
    attributes,
  };
}

function bump(
  attributes: Record<string, number | null>,
  key: AttributeKey,
  amount: number,
  max: number
) {
  const cur = attributes[key];
  if (cur == null) return;
  attributes[key] = Math.min(20, Math.max(1, cur + amount));
  if (max && attributes[key]! > max + 2) attributes[key] = max + 2;
}

// FM tabanlı, dengeli pozisyon eğilimi: pozisyonun anahtar özelliklerini belirgin
// (ama abartısız) yükseltir. Böylece bir stoper savunmada, forvet hücumda öne çıkar.
function applyPositionBias(
  attributes: Record<string, number | null>,
  position: Position,
  max: number
) {
  const b = 3; // dengeli vurgu
  for (const key of keyAttrs(position)) {
    bump(attributes, key, b, max);
  }
}

// Pozisyon-ağırlıklı genel puan: pozisyonun anahtar özellikleri daha çok ağırlık yapar.
// Kaleci için alakasız teknik özellikler (şut vb.) hesaba katılmaz.
export function overallRating(
  source: Partial<Record<AttributeKey, number | null>>,
  position: string,
): number {
  const keySet = new Set(keyAttrs(position));
  const pool = position === "GK"
    ? [...GOALKEEPING_ATTRS, ...MENTAL_ATTRS, ...PHYSICAL_ATTRS]
    : ALL_OUTFIELD_ATTRS;
  let sum = 0, w = 0;
  for (const key of pool) {
    const v = source[key];
    if (typeof v !== "number") continue;
    const weight = keySet.has(key) ? 2.2 : 0.7;
    sum += v * weight; w += weight;
  }
  return w ? Math.round(sum / w) : 0;
}

// Değer hesabı: ortalama attribute + yaş + potansiyel
// Genç 5-15k | Orta 15-30k | İyi 30-45k | Elit 45-60k CR aralığına yaklaşır.
// Export: antrenman/cron sonrası oyuncu değeri bu formülle YENİDEN hesaplanır
// (gelişim → değer artışı) — al-geliştir-sat ticareti buna dayanır.
export function computeValue(
  attributes: Record<string, number | null>,
  position: Position,
  age: number,
  potential: number | null
): number {
  const avg = overallRating(attributes, position); // pozisyon-ağırlıklı ~8-16
  let base = (avg - 6) * 4000; // 8 -> 8k, 14 -> 32k

  // Genç + yüksek potansiyel primi
  if (age <= 21) base += ((potential ?? 10) - 10) * 1500;
  // Veteran düşüşü
  if (age >= 31) base -= (age - 30) * 2500;

  base = Math.max(2000, Math.round(base / 500) * 500);
  return base;
}

// Onboarding minimum pozisyon gereksinimleri (master bağlam: 1 GK, 4 DF, 4 MF, 3 FW)
export const SQUAD_REQUIREMENTS = {
  GK: { min: 1, label: "Kaleci" },
  DF: { min: 4, label: "Defans" },
  MF: { min: 4, label: "Orta Saha" },
  FW: { min: 3, label: "Forvet" },
} as const;

export const ONBOARDING_SQUAD_SIZE = 25;

export function validateSquad(positions: Position[]): string | null {
  if (positions.length !== ONBOARDING_SQUAD_SIZE) {
    return `Tam ${ONBOARDING_SQUAD_SIZE} oyuncu gerekli (şu an ${positions.length}).`;
  }
  for (const [pos, req] of Object.entries(SQUAD_REQUIREMENTS)) {
    const count = positions.filter((p) => p === pos).length;
    if (count < req.min) {
      return `En az ${req.min} ${req.label} gerekli (şu an ${count}).`;
    }
  }
  return null;
}
