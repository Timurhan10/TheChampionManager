-- =====================================================================
-- Atomik kredi güncelleme — satış parası yarış durumu (race condition) düzeltmesi
-- =====================================================================
-- Sorun: bakiye JS'te okunup credits+delta yazılınca, aynı anda birden çok satış
-- olduğunda stale-okuma nedeniyle yalnızca son yazma kalıyordu (para kayboluyordu).
-- Çözüm: veritabanında tek atomik ifadeyle artış/azalış.
create or replace function add_credits(uid uuid, delta integer)
returns void
language sql
as $$
  update users set credits = greatest(0, credits + delta) where id = uid;
$$;

grant execute on function add_credits(uuid, integer) to service_role, authenticated, anon;
