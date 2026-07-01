// Oyun geneli sabitler

export const LEAGUE_SIZE = 12; // Lig başına takım
export const SEASON_WEEKS = 11; // 22 tur / haftada 2

// Maç sonu CR ödülleri (master bağlam)
export const MATCH_REWARDS = {
  win: 4000,
  draw: 1500,
  loss: 500,
} as const;

// Sezon sonu CMP ödülleri
export const SEASON_CMP = {
  champion: 500,
  second: 250,
  third: 100,
  unbeaten: 300,
} as const;

// Sezon sonu CR ödülleri — dereceye göre (koşulsuz 100k enflasyonu kaldırıldı;
// sıralama ekonomik olarak da önemli).
export const SEASON_CR = {
  first: 100000,
  second: 75000,
  third: 60000,
  mid: 40000,
  bottom: 25000, // son iki sıra
} as const;

export const STARTING_CREDITS = 100000;
