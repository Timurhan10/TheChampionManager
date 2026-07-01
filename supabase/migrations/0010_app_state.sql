-- =====================================================================
-- Global anahtar-değer durum tablosu (ör. serbest oyuncu son yenileme zamanı)
-- =====================================================================
-- Serbest oyuncu yenileme kapısı, oyuncuların created_at'ine bakıp kalıcı
-- kilitleniyordu. Bunun yerine global bir "son yenileme" damgası tutulur.
create table if not exists app_state (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);
grant all on app_state to service_role;
