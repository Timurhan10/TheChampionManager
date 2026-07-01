-- =====================================================================
-- Günlük antrenman sistemi
-- =====================================================================
-- Günlük antrenman kayıtları (limit + geçmiş): günde 3 (takım), 1/oyuncu.
create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  kind text not null,
  created_at timestamptz default now()
);
create index if not exists idx_training_sessions_team_created on training_sessions(team_id, created_at);

-- Oyuncuda kesirli gelişim birikimi (1-20 skalada yumuşak artış).
alter table players add column if not exists training_progress jsonb default '{}'::jsonb;

-- Kulüp antrenman tesisi seviyesi (kalite katsayısı; CMP ile yükseltilebilir).
alter table teams add column if not exists training_facility_level smallint default 1;

grant all on training_sessions to service_role;
