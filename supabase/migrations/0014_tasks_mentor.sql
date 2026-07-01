-- =====================================================================
-- Günlük görevler + mentor sistemi + maç tamamlanma zamanı
-- =====================================================================

-- Görev ödülü talepleri: takım + görev + gün başına tek claim (çift claim engeli unique ile).
create table if not exists task_claims (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  task_key text not null,
  day date not null,
  claimed_at timestamptz default now(),
  unique (team_id, task_key, day)
);
create index if not exists idx_task_claims_team_day on task_claims(team_id, day);
grant all on task_claims to service_role;

-- Mentor: mentee oyuncu → mentor oyuncu referansı (aynı takım, kurallar sunucuda).
alter table players add column if not exists mentor_id uuid references players(id) on delete set null;

-- Maçın gerçekten tamamlandığı an ("bugün maç kazan" görevi için; scheduled_at fikstür zamanı).
alter table matches add column if not exists played_at timestamptz;
