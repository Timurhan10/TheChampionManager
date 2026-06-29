-- =====================================================================
-- Faz 6: CMP mağaza ürünleri (seed) + bildirimler tablosu
-- =====================================================================

-- CMP MAĞAZA ÜRÜNLERİ
INSERT INTO cmp_shop_items (name, description, tier, cmp_cost, item_type, item_data) VALUES
  -- BRONZ
  ('Ekstra Scout Görevi', 'Scout seviyeni 1 kademe yükseltir.', 'bronze', 100, 'scout_boost', '{}'),
  ('5.000 CR Bonus', 'Kasana anında 5.000 CR ekler.', 'bronze', 200, 'cr_bonus', '{"amount":5000}'),
  ('Scout Hız Bonusu', 'Scout seviyeni 1 kademe yükseltir.', 'bronze', 500, 'scout_boost', '{}'),
  -- GÜMÜŞ
  ('Garantili Genç Yetenek', 'Yüksek potansiyelli bir genç oyuncu (16-19 yaş).', 'silver', 1000, 'youth_player', '{}'),
  ('20.000 CR Bonus', 'Kasana anında 20.000 CR ekler.', 'silver', 2000, 'cr_bonus', '{"amount":20000}'),
  ('Nadir Deneyimli Oyuncu', 'Tecrübeli bir veteran (31-34 yaş, güçlü).', 'silver', 3000, 'veteran_player', '{}'),
  ('Stat Görünür Elite', 'Elit seviye bir oyuncu, tüm statları görünür.', 'silver', 5000, 'elite_player', '{}'),
  -- ALTIN
  ('Alt Yapı Süperstar', 'Çok yüksek potansiyelli genç süperstar.', 'gold', 10000, 'youth_player', '{"superstar":true}'),
  ('Takım Antrenman Bonusu', 'Tüm kadronun rastgele özelliklerini geliştirir.', 'gold', 15000, 'training_bonus', '{}'),
  ('Efsanevi Oyuncu', 'Neredeyse maksimum statlara sahip efsane.', 'gold', 25000, 'legendary_player', '{}');

-- BİLDİRİMLER
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(140) NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
