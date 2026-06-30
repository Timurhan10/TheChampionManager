-- =====================================================================
-- Otomatik satış için: oyuncunun ne zaman satışa çıkarıldığı.
-- "En geç 3 günde satılır" garantisi bu zamana göre işler.
-- =====================================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS listed_at TIMESTAMPTZ;

-- Hâlihazırda satışta olanların listeleme zamanını şimdi olarak işaretle
UPDATE players SET listed_at = NOW() WHERE for_sale = TRUE AND listed_at IS NULL;
