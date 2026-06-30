-- =====================================================================
-- Maç reytingi + forma numarası + oyuncu-bazlı taktik talimatları
-- =====================================================================

-- Oyuncu: forma no, oynanan maç, reyting toplamı (ortalama = rating_sum/matches_played)
ALTER TABLE players ADD COLUMN IF NOT EXISTS shirt_number SMALLINT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS matches_played INT DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rating_sum NUMERIC DEFAULT 0;

-- Taktik: oyuncu-bazlı talimatlar (oyuncu_id -> {role, pressing, passing, risk, shooting, run})
ALTER TABLE tactics ADD COLUMN IF NOT EXISTS player_instructions JSONB DEFAULT '{}';

-- Mevcut oyunculara forma no ata (takım içi oluşturma sırasına göre 1..N)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY created_at) AS rn
  FROM players
  WHERE team_id IS NOT NULL
)
UPDATE players p
SET shirt_number = n.rn
FROM numbered n
WHERE p.id = n.id AND p.shirt_number IS NULL;
