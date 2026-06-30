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
