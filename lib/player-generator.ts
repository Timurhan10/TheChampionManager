// The Champion Manager — Oyuncu üretim mantığı
// Master bağlam: tüm attribute'lar 8-12 random, potansiyel yaşa göre, değer hesabı.

import {
  ALL_ATTRS,
  ALL_OUTFIELD_ATTRS,
  GOALKEEPING_ATTRS,
  type AttributeKey,
} from "./attributes";
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
  attributes: Record<string, number | null>;
}

export interface GenerateOptions {
  name?: string;
  age?: number;
  position: Position;
  isYouth?: boolean;
  // Attribute üretim aralığı (varsayılan 8-12; AI takımları 8-14 kullanabilir)
  attrMin?: number;
  attrMax?: number;
}

export function generatePlayer(opts: GenerateOptions): GeneratedPlayer {
  const position = opts.position;
  const isYouth = opts.isYouth ?? false;
  const age = opts.age ?? (isYouth ? randInt(16, 19) : randInt(18, 33));
  const attrMin = opts.attrMin ?? 8;
  const attrMax = opts.attrMax ?? 12;

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

  const potential = potentialForAge(age);
  const value_cr = computeValue(attributes, position, age, potential);

  return {
    name: opts.name ?? generatePlayerName(),
    age,
    position,
    potential,
    value_cr,
    is_youth_academy: isYouth,
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

function applyPositionBias(
  attributes: Record<string, number | null>,
  position: Position,
  max: number
) {
  const b = 2;
  switch (position) {
    case "FW":
      bump(attributes, "shooting", b, max);
      bump(attributes, "off_the_ball", b, max);
      bump(attributes, "pace", b, max);
      break;
    case "MF":
      bump(attributes, "passing", b, max);
      bump(attributes, "vision", b, max);
      bump(attributes, "stamina", b, max);
      break;
    case "DF":
      bump(attributes, "tackling", b, max);
      bump(attributes, "positioning", b, max);
      bump(attributes, "strength", b, max);
      break;
    case "GK":
      bump(attributes, "reflexes", b, max);
      bump(attributes, "handling", b, max);
      break;
  }
}

// Ortalama rating — sadece attribute alanlarını hesaba katar (kaleci attr'ları dahil).
// Player nesnesi de doğrudan geçirilebilir; attribute olmayan alanlar göz ardı edilir.
export function averageRating(source: Partial<Record<AttributeKey, number | null>>): number {
  const vals: number[] = [];
  for (const key of ALL_ATTRS) {
    const v = source[key];
    if (typeof v === "number") vals.push(v);
  }
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Değer hesabı: ortalama attribute + yaş + potansiyel
// Genç 5-15k | Orta 15-30k | İyi 30-45k | Elit 45-60k CR aralığına yaklaşır.
function computeValue(
  attributes: Record<string, number | null>,
  position: Position,
  age: number,
  potential: number
): number {
  const avg = averageRating(attributes); // ~8-14
  let base = (avg - 6) * 4000; // 8 -> 8k, 14 -> 32k

  // Genç + yüksek potansiyel primi
  if (age <= 21) base += (potential - 10) * 1500;
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
