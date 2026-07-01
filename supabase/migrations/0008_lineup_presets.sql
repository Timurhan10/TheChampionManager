-- =====================================================================
-- İlk 11 / taktik kayıt slotları (presets)
-- =====================================================================
-- Her takım için en fazla 3 isimli "tüm taktik" kaydı tutulur.
-- Her preset: { name, formation, mentality, pressing, tempo, pass_style,
--               lineup, substitutes, player_instructions }
ALTER TABLE tactics ADD COLUMN IF NOT EXISTS presets JSONB DEFAULT '[]'::jsonb;
