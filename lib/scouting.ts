// Scouting yardımcıları: hangi attribute'ların açılacağını seçer.
// Not: RLS oyuncu satırlarını okumaya izin verir; "gizlilik" uygulama katmanındadır.
// Bu yüzden scouting_reports.revealed_attributes yalnızca AÇILAN KEY listesini tutar;
// değerler oyuncu satırından okunur.

import {
  TECHNICAL_ATTRS,
  MENTAL_ATTRS,
  PHYSICAL_ATTRS,
  GOALKEEPING_ATTRS,
  ALL_OUTFIELD_ATTRS,
  type AttributeKey,
} from "./attributes";
import type { Position } from "@/types/game";

export type ScoutLevelPkg = "basic" | "detailed" | "full";

export const SCOUT_PACKAGES: Record<ScoutLevelPkg, { cost: number; hours: number; label: string; desc: string }> = {
  basic: { cost: 500, hours: 0, label: "Temel", desc: "Anlık · 3-5 özellik" },
  detailed: { cost: 2000, hours: 12, label: "Detaylı", desc: "12 saat · 12 özellik" },
  full: { cost: 5000, hours: 48, label: "Tam", desc: "48 saat · tüm özellikler" },
};

// Scout seviyesi yükseltme artık CMP ile yapılır (CR sadece arama için).
export const SCOUT_UPGRADE_CMP = 300;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function attrPool(position: Position): AttributeKey[] {
  return position === "GK" ? [...ALL_OUTFIELD_ATTRS, ...GOALKEEPING_ATTRS] : [...ALL_OUTFIELD_ATTRS];
}

// Açılacak attribute key'lerini seç.
export function pickRevealKeys(
  pkg: ScoutLevelPkg,
  scoutLevel: number,
  position: Position
): AttributeKey[] {
  if (pkg === "full") {
    return attrPool(position);
  }

  if (pkg === "basic") {
    // 4 + (seviye-1)*2, teknik ağırlıklı
    const count = 4 + (scoutLevel - 1) * 2;
    const techHeavy = [...shuffle(TECHNICAL_ATTRS).slice(0, Math.ceil(count * 0.6)), ...shuffle([...MENTAL_ATTRS, ...PHYSICAL_ATTRS]).slice(0, count)];
    return Array.from(new Set(techHeavy)).slice(0, count);
  }

  // detailed: 12 + (seviye-1)*3, 3 kategoriden
  const count = 12 + (scoutLevel - 1) * 3;
  const mixed = [
    ...shuffle(TECHNICAL_ATTRS).slice(0, 5),
    ...shuffle(MENTAL_ATTRS).slice(0, 5),
    ...shuffle(PHYSICAL_ATTRS).slice(0, 4),
    ...shuffle(attrPool(position)),
  ];
  return Array.from(new Set(mixed)).slice(0, count);
}
