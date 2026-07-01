-- =====================================================================
-- Taktik v2: oyun stili + ince ayarlar (Motor v2)
-- =====================================================================
ALTER TABLE tactics
  ADD COLUMN IF NOT EXISTS style VARCHAR(24),                   -- NULL = stil seçilmemiş (Dengeli varsayılır)
  ADD COLUMN IF NOT EXISTS advanced JSONB DEFAULT '{}'::jsonb;  -- width, defensive_line, time_wasting, counter_attack
