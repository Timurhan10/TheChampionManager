-- =====================================================================
-- Atomik CMP güncelleme — add_credits'in CMP karşılığı
-- =====================================================================
-- Tek kural tek yer: tüm CR değişimleri add_credits, tüm CMP değişimleri add_cmp
-- üzerinden yapılır (JS'te oku-hesapla-yaz yarış durumu kalmaz).
create or replace function add_cmp(uid uuid, delta integer)
returns void
language sql
as $$
  update users set cmp_points = greatest(0, cmp_points + delta) where id = uid;
$$;

grant execute on function add_cmp(uuid, integer) to service_role, authenticated, anon;
