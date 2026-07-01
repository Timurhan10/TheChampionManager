-- =====================================================================
-- Oyuncu uyruğu (ülke bazlı scouting için)
-- =====================================================================
ALTER TABLE players ADD COLUMN IF NOT EXISTS country TEXT;
