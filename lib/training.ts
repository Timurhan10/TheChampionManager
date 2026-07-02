// Günlük antrenman gelişim matematiği (1-20 skalaya uyarlanmış).
// Gelişim: potansiyel + yaş + mevcut güç + tesis kalitesi + rastgelelik + pozisyon uyumu.
// Kesirli birikim training_progress'te tutulur; ≥1 olunca integer attribute +1.
import type { AttributeKey } from "./attributes";
import { ATTR_LABELS } from "./attributes";
import { potentialStars } from "./utils";
import type { Player, Position } from "@/types/game";

export type TrainingKind = "technical" | "physical" | "mental" | "defensive" | "goalkeeping";

// Günlük antrenman hakkı — TEK kaynak (API, sayfa ve UI aynı sabiti kullanır).
export const DAILY_TRAINING_LIMIT = 3;

export const TRAINING_TYPES: Record<TrainingKind, { label: string; attrs: AttributeKey[]; pos: Position[] }> = {
  technical: { label: "Teknik", attrs: ["passing", "shooting", "first_touch", "dribbling", "technique", "crossing"], pos: ["FW", "MF"] },
  physical: { label: "Fiziksel", attrs: ["pace", "acceleration", "strength", "stamina", "agility", "jumping"], pos: ["FW", "DF", "MF"] },
  mental: { label: "Mental", attrs: ["vision", "decisions", "concentration", "positioning", "composure", "leadership"], pos: ["MF"] },
  defensive: { label: "Savunma", attrs: ["tackling", "positioning", "heading", "strength", "anticipation", "concentration"], pos: ["DF"] },
  goalkeeping: { label: "Kaleci", attrs: ["reflexes", "handling", "one_on_ones", "command_of_area", "kicking", "rushing_out"], pos: ["GK"] },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function potentialCoef(potential: number | null): number {
  const stars = potentialStars(potential ?? 10); // tek yıldız kuralı (lib/utils)
  return [0, 0.4, 0.65, 1.0, 1.35, 1.75][stars];
}
function ageCoef(age: number): number {
  if (age <= 18) return 1.4;
  if (age <= 21) return 1.25;
  if (age <= 24) return 1.1;
  if (age <= 28) return 0.9;
  if (age <= 32) return 0.65;
  return 0.35;
}
// Mevcut güç arttıkça gelişim zorlaşır (1-20 skala)
function strengthCoef(v: number): number {
  if (v <= 8) return 1.3;
  if (v <= 12) return 1.1;
  if (v <= 15) return 0.9;
  if (v <= 17) return 0.65;
  if (v <= 19) return 0.4;
  return 0.2;
}
export function facilityCoef(level: number): number {
  return [0, 1.0, 1.15, 1.3, 1.4, 1.5][clamp(level, 1, 5)];
}

// Tesis yükseltme: hedef seviye → CR maliyeti. CR gideri + kalıcı gelişim yatırımı
// (facilityCoef antrenman kazancını çarpar). Seviye 5 en üst.
export const FACILITY_COSTS: Record<number, number> = { 2: 40000, 3: 80000, 4: 150000, 5: 250000 };
export const FACILITY_MAX_LEVEL = 5;
export const FACILITY_LABELS = ["", "Normal", "İyi", "Çok İyi", "Üst Düzey", "Elit"];

// --- Mentor sistemi ---
// Tecrübeli oyuncu genç takım arkadaşının gelişimini hızlandırır (pasif bonus:
// mentorun o gün antrenman yapması gerekmez). Kurallar hem UI hem API'de bu
// fonksiyonla doğrulanır.
export const MENTOR_BONUS = 1.25; // mentee antrenman kazancı çarpanı
export const MENTOR_MAX_MENTEES = 2;
export const MENTOR_MIN_AGE = 29;
export const MENTOR_OVERALL_GAP = 2;

export function mentorEligibilityError(
  mentor: { id: string; age: number; position: string; overall: number },
  mentee: { id: string; age: number; position: string; overall: number },
): string | null {
  if (mentor.id === mentee.id) return "Oyuncu kendine mentor olamaz.";
  if (mentor.age < MENTOR_MIN_AGE) return `Mentor en az ${MENTOR_MIN_AGE} yaşında olmalı.`;
  if (mentor.position !== mentee.position) return "Mentor ve oyuncu aynı pozisyonda olmalı.";
  if (mentor.overall < mentee.overall + MENTOR_OVERALL_GAP) return `Mentorun genel puanı en az +${MENTOR_OVERALL_GAP} yüksek olmalı.`;
  return null;
}

export interface TrainingGain { key: AttributeKey; label: string; amount: number; newValue: number; levelUp: boolean; }
export interface TrainingResult {
  gains: TrainingGain[];
  attrPatch: Record<string, number>;      // integer attribute güncellemeleri
  progress: Record<string, number>;       // yeni training_progress
  failed: boolean;
}

// rng verilmezse Math.random (server route). Saf/test edilebilir.
// mentorMult: mentee ise MENTOR_BONUS (1.25), yoksa 1.
export function runTraining(
  player: Player,
  kind: TrainingKind,
  facilityLevel: number,
  rng: () => number = Math.random,
  mentorMult = 1,
): TrainingResult {
  const type = TRAINING_TYPES[kind];
  const progress: Record<string, number> = { ...((player as any).training_progress ?? {}) };
  const attrPatch: Record<string, number> = {};
  const gains: TrainingGain[] = [];

  // En düşük 3 uygun özelliği seç (zayıf yönleri geliştir), yoksa rastgele
  const pool = type.attrs
    .map((k) => ({ k, v: typeof (player as any)[k] === "number" ? ((player as any)[k] as number) : 10 }))
    .filter((x) => x.v < 20)
    .sort((a, b) => a.v - b.v);
  if (pool.length === 0) return { gains: [], attrPatch: {}, progress, failed: false };
  const chosen = pool.slice(0, 3);
  const shares = [0.6, 0.25, 0.15];

  const posBonus = type.pos.includes(player.position) ? 1.15 : 0.8;
  const failed = rng() < 0.12;
  const failMult = failed ? 0.35 : 1;

  const base = 0.35;
  const pc = potentialCoef(player.potential ?? null);
  const ac = ageCoef(player.age);
  const fc = facilityCoef(facilityLevel);

  chosen.forEach((c, i) => {
    const sc = strengthCoef(c.v);
    const rand = 0.85 + rng() * 0.3;
    let growth = base * pc * ac * sc * fc * rand * posBonus * (shares[i] / 0.6);
    growth = clamp(growth, 0.02, 0.7) * failMult * mentorMult;

    const cur = c.v;
    const acc = (progress[c.k] ?? 0) + growth;
    const inc = Math.floor(acc);
    const newValue = Math.min(20, cur + inc);
    progress[c.k] = acc - inc;
    if (inc > 0) attrPatch[c.k] = newValue;
    gains.push({ key: c.k, label: ATTR_LABELS[c.k], amount: Math.round(growth * 100) / 100, newValue, levelUp: newValue > cur });
  });

  return { gains, attrPatch, progress, failed };
}
