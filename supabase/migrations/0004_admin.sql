-- =====================================================================
-- Faz/Geliştirme: Admin yetkisi
-- users tablosuna is_admin kolonu + belirtilen hesabı admin yapma
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Belirtilen e-postaya sahip kullanıcıyı admin yap
UPDATE users
SET is_admin = TRUE
WHERE id = (SELECT id FROM auth.users WHERE email = 'timurhan.duzgun.20@hotmail.com');
