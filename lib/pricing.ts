// GİZLİ İÇ MANTIK — kullanıcıya gösterilmez.
// Satış fiyatı: maç oynamadıysa piyasa değeri; performansa göre ±.
//  - Ortalama reyting yüksek (→7.5) : piyasa değerinin +%50'sine kadar
//  - Ortalama reyting düşük (→4.0)  : piyasa değerinin altında
//  - 6.0 nötr (piyasa değeri)

export function computeSellPrice(p: {
  value_cr: number;
  matches_played?: number | null;
  rating_sum?: number | null;
}): number {
  const base = p.value_cr ?? 0;
  const mp = p.matches_played ?? 0;
  if (mp <= 0) return Math.max(500, base); // hiç maç yok → piyasa değeri

  const avg = Number(p.rating_sum ?? 0) / mp; // 0-10
  let factor: number;
  if (avg >= 6.0) {
    factor = 1 + Math.min(0.5, ((avg - 6.0) / 1.5) * 0.5); // 6→1.0, 7.5+→1.5
  } else {
    factor = Math.max(0.55, 1 - ((6.0 - avg) / 2.0) * 0.45); // 6→1.0, 4→~0.55
  }
  return Math.max(500, Math.round((base * factor) / 100) * 100);
}

// --- Otomatik satış (GİZLİ): piyasa değeri + performans + yaş + mevki + talep ---
interface SaleInput {
  value_cr: number;
  matches_played?: number | null;
  rating_sum?: number | null;
  age: number;
  position: string;
}

function ageFactor(age: number): number {
  if (age <= 23) return 1.05;
  if (age <= 29) return 1.0;
  if (age <= 32) return 0.9;
  return 0.75;
}
function positionDemand(pos: string): number {
  return pos === "FW" ? 1.05 : pos === "MF" ? 1.0 : pos === "DF" ? 0.98 : 0.95; // GK en az talep
}

export function computeAutoSalePrice(p: SaleInput): number {
  // Performans katmanı (computeSellPrice mantığı) → sonra yaş/mevki/talep
  const perfPriced = computeSellPrice(p);
  const demand = 0.92 + Math.random() * 0.16; // 0.92–1.08
  const price = perfPriced * ageFactor(p.age) * positionDemand(p.position) * demand;
  return Math.max(500, Math.round(price / 100) * 100);
}

// Bu cron çalışmasında satılma olasılığı (iyi/değerli oyuncu daha çabuk satılır).
// 3 gün dolduysa çağıran taraf zaten zorla satar.
export function sellProbability(p: SaleInput): number {
  const mp = p.matches_played ?? 0;
  const avg = mp > 0 ? Number(p.rating_sum ?? 0) / mp : 6.0;
  let prob = 0.45 + (avg - 6.0) * 0.06 + positionDemand(p.position) - 1; // ~0.3–0.7
  return Math.max(0.25, Math.min(0.8, prob));
}
