-- =====================================================================
-- Okuma (SELECT) RLS politikaları — lig/maç/transfer vb. "bulunamadı" bug'ını kökten giderir.
-- Bu tablolarda RLS açık olup SELECT politikası olmaması, authenticated rolünün satırları
-- SESSİZCE boş görmesine yol açıyordu. Tüm yazımlar zaten service_role API'lerinde (RLS bypass),
-- bu yüzden yalnızca okuma politikası eklemek yeterli ve güvenli. Idempotent.
-- =====================================================================

-- Herkese açık okunabilir oyun verisi
ALTER TABLE leagues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouting_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE youth_academy      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmp_shop_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmp_purchases      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read leagues"          ON leagues;
DROP POLICY IF EXISTS "read league_teams"     ON league_teams;
DROP POLICY IF EXISTS "read matches"          ON matches;
DROP POLICY IF EXISTS "read tactics"          ON tactics;
DROP POLICY IF EXISTS "read transfers"        ON transfers;
DROP POLICY IF EXISTS "read scouting_reports" ON scouting_reports;
DROP POLICY IF EXISTS "read youth_academy"    ON youth_academy;
DROP POLICY IF EXISTS "read cmp_shop_items"   ON cmp_shop_items;
DROP POLICY IF EXISTS "read own cmp_purchases" ON cmp_purchases;

CREATE POLICY "read leagues"          ON leagues          FOR SELECT TO authenticated USING (true);
CREATE POLICY "read league_teams"     ON league_teams     FOR SELECT TO authenticated USING (true);
CREATE POLICY "read matches"          ON matches          FOR SELECT TO authenticated USING (true);
CREATE POLICY "read tactics"          ON tactics          FOR SELECT TO authenticated USING (true);
CREATE POLICY "read transfers"        ON transfers        FOR SELECT TO authenticated USING (true);
CREATE POLICY "read scouting_reports" ON scouting_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "read youth_academy"    ON youth_academy    FOR SELECT TO authenticated USING (true);
CREATE POLICY "read cmp_shop_items"   ON cmp_shop_items   FOR SELECT TO authenticated USING (true);
CREATE POLICY "read own cmp_purchases" ON cmp_purchases   FOR SELECT TO authenticated USING (auth.uid() = user_id);
