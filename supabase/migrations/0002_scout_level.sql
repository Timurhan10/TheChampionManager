-- =====================================================================
-- Faz 4: Scout seviyesi (takım bazında) + yararlı indeksler
-- =====================================================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS scout_level SMALLINT DEFAULT 1 CHECK (scout_level BETWEEN 1 AND 3);

CREATE INDEX IF NOT EXISTS idx_scouting_scout_team ON scouting_reports(scout_team_id);
CREATE INDEX IF NOT EXISTS idx_scouting_status ON scouting_reports(status);
CREATE INDEX IF NOT EXISTS idx_transfers_to_team ON transfers(to_team_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_team ON transfers(from_team_id);
CREATE INDEX IF NOT EXISTS idx_players_youth ON players(is_youth_academy) WHERE is_youth_academy = TRUE;
