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
  promotion: 150,
  unbeaten: 300,
} as const;

export const STARTING_CREDITS = 100000;
