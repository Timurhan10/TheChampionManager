// GİZLİ İÇ MANTIK — kullanıcıya gösterilmez.
// TEK satış kuralı: computeSellPrice (anında satış). TEK alım kuralı: computeBuyPrice.

// transfers.message üzerinde "satıcıya ödendi" işareti (çift ödeme koruması).
export const SALE_PAID_MARK = "seller_paid";

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

// --- Alım fiyatı: değer × pozisyon talebi × yaş primi × %10 alım spreadi ---
// Spread sayesinde anlık al-sat arbitrajı kapalı: kâr etmek için oyuncuyu
// GELİŞTİRMEK gerekir (genç + potansiyelli al → antrenmanla büyüt → değer artınca sat).
export function computeBuyPrice(p: {
  value_cr: number;
  age: number;
  position: string;
  potential?: number | null;
}): number {
  const demand = p.position === "FW" ? 1.08 : p.position === "MF" ? 1.0 : p.position === "DF" ? 0.97 : 0.94;
  const pot = p.potential ?? 10;
  const agePremium = p.age <= 21 && pot >= 14 ? 1.15 : p.age <= 23 ? 1.08 : p.age >= 31 ? 0.85 : 1.0;
  const price = (p.value_cr ?? 0) * demand * agePremium * 1.10;
  return Math.max(1000, Math.round(price / 100) * 100);
}

