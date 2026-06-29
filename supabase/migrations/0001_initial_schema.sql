-- =====================================================================
-- The Champion Manager — Faz 0: Başlangıç Veritabanı Şeması
-- Supabase SQL editöründe çalıştırın.
-- =====================================================================

-- ENUM TİPLERİ
CREATE TYPE player_position AS ENUM ('GK', 'DF', 'MF', 'FW');
CREATE TYPE league_status AS ENUM ('waiting', 'active', 'finished');
CREATE TYPE match_status AS ENUM ('scheduled', 'live', 'finished');
CREATE TYPE transfer_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
CREATE TYPE scout_level AS ENUM ('basic', 'detailed', 'full');
CREATE TYPE scout_status AS ENUM ('pending', 'completed');
CREATE TYPE match_day AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  credits INTEGER DEFAULT 100000 CHECK (credits >= 0),
  cmp_points INTEGER DEFAULT 0 CHECK (cmp_points >= 0),
  is_subscribed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TEAMS
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  primary_color VARCHAR(7) DEFAULT '#10B981',
  secondary_color VARCHAR(7) DEFAULT '#1A2A3E',
  is_ai BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PLAYERS (44 attribute + gizli potansiyel)
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 15 AND 45),
  position player_position NOT NULL,
  is_youth_academy BOOLEAN DEFAULT FALSE,
  potential SMALLINT CHECK (potential BETWEEN 1 AND 20), -- gizli
  -- Teknik (14)
  passing SMALLINT DEFAULT 10 CHECK (passing BETWEEN 1 AND 20),
  shooting SMALLINT DEFAULT 10 CHECK (shooting BETWEEN 1 AND 20),
  dribbling SMALLINT DEFAULT 10 CHECK (dribbling BETWEEN 1 AND 20),
  heading SMALLINT DEFAULT 10 CHECK (heading BETWEEN 1 AND 20),
  first_touch SMALLINT DEFAULT 10 CHECK (first_touch BETWEEN 1 AND 20),
  tackling SMALLINT DEFAULT 10 CHECK (tackling BETWEEN 1 AND 20),
  long_shots SMALLINT DEFAULT 10 CHECK (long_shots BETWEEN 1 AND 20),
  free_kick SMALLINT DEFAULT 10 CHECK (free_kick BETWEEN 1 AND 20),
  corners SMALLINT DEFAULT 10 CHECK (corners BETWEEN 1 AND 20),
  crossing SMALLINT DEFAULT 10 CHECK (crossing BETWEEN 1 AND 20),
  penalty SMALLINT DEFAULT 10 CHECK (penalty BETWEEN 1 AND 20),
  long_throw SMALLINT DEFAULT 10 CHECK (long_throw BETWEEN 1 AND 20),
  technique SMALLINT DEFAULT 10 CHECK (technique BETWEEN 1 AND 20),
  long_balls SMALLINT DEFAULT 10 CHECK (long_balls BETWEEN 1 AND 20),
  -- Zihinsel (14)
  determination SMALLINT DEFAULT 10 CHECK (determination BETWEEN 1 AND 20),
  concentration SMALLINT DEFAULT 10 CHECK (concentration BETWEEN 1 AND 20),
  aggression SMALLINT DEFAULT 10 CHECK (aggression BETWEEN 1 AND 20),
  bravery SMALLINT DEFAULT 10 CHECK (bravery BETWEEN 1 AND 20),
  leadership SMALLINT DEFAULT 10 CHECK (leadership BETWEEN 1 AND 20),
  teamwork SMALLINT DEFAULT 10 CHECK (teamwork BETWEEN 1 AND 20),
  work_rate SMALLINT DEFAULT 10 CHECK (work_rate BETWEEN 1 AND 20),
  vision SMALLINT DEFAULT 10 CHECK (vision BETWEEN 1 AND 20),
  off_the_ball SMALLINT DEFAULT 10 CHECK (off_the_ball BETWEEN 1 AND 20),
  positioning SMALLINT DEFAULT 10 CHECK (positioning BETWEEN 1 AND 20),
  decisions SMALLINT DEFAULT 10 CHECK (decisions BETWEEN 1 AND 20),
  flair SMALLINT DEFAULT 10 CHECK (flair BETWEEN 1 AND 20),
  anticipation SMALLINT DEFAULT 10 CHECK (anticipation BETWEEN 1 AND 20),
  composure SMALLINT DEFAULT 10 CHECK (composure BETWEEN 1 AND 20),
  -- Fiziksel (8)
  pace SMALLINT DEFAULT 10 CHECK (pace BETWEEN 1 AND 20),
  acceleration SMALLINT DEFAULT 10 CHECK (acceleration BETWEEN 1 AND 20),
  stamina SMALLINT DEFAULT 10 CHECK (stamina BETWEEN 1 AND 20),
  strength SMALLINT DEFAULT 10 CHECK (strength BETWEEN 1 AND 20),
  agility SMALLINT DEFAULT 10 CHECK (agility BETWEEN 1 AND 20),
  balance SMALLINT DEFAULT 10 CHECK (balance BETWEEN 1 AND 20),
  jumping SMALLINT DEFAULT 10 CHECK (jumping BETWEEN 1 AND 20),
  natural_fitness SMALLINT DEFAULT 10 CHECK (natural_fitness BETWEEN 1 AND 20),
  -- Kaleci özel (8, null diğerleri için)
  reflexes SMALLINT CHECK (reflexes BETWEEN 1 AND 20),
  handling SMALLINT CHECK (handling BETWEEN 1 AND 20),
  one_on_ones SMALLINT CHECK (one_on_ones BETWEEN 1 AND 20),
  command_of_area SMALLINT CHECK (command_of_area BETWEEN 1 AND 20),
  communication SMALLINT CHECK (communication BETWEEN 1 AND 20),
  rushing_out SMALLINT CHECK (rushing_out BETWEEN 1 AND 20),
  kicking SMALLINT CHECK (kicking BETWEEN 1 AND 20),
  throwing SMALLINT CHECK (throwing BETWEEN 1 AND 20),
  -- Meta
  value_cr INTEGER DEFAULT 10000 CHECK (value_cr >= 0),
  for_sale BOOLEAN DEFAULT FALSE,
  asking_price INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_players_for_sale ON players(for_sale) WHERE for_sale = TRUE;

-- LEAGUES
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  creator_id UUID REFERENCES users(id),
  match_day_1 match_day NOT NULL,
  match_day_2 match_day NOT NULL,
  match_time TIME NOT NULL,
  season_number INTEGER DEFAULT 1,
  status league_status DEFAULT 'waiting',
  invite_code VARCHAR(8) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEAGUE_TEAMS
CREATE TABLE league_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  points INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  UNIQUE(league_id, team_id)
);

-- MATCHES
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  week INTEGER,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status match_status DEFAULT 'scheduled',
  home_score INTEGER,
  away_score INTEGER,
  match_events JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_league ON matches(league_id);
CREATE INDEX idx_matches_status ON matches(status);

-- TACTICS
CREATE TABLE tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) UNIQUE,
  formation VARCHAR(10) DEFAULT '4-4-2',
  mentality VARCHAR(20) DEFAULT 'balanced',
  pressing VARCHAR(20) DEFAULT 'medium',
  tempo VARCHAR(20) DEFAULT 'normal',
  pass_style VARCHAR(20) DEFAULT 'mixed',
  lineup JSONB DEFAULT '{}',
  substitutes JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRANSFERS
CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  from_team_id UUID REFERENCES teams(id),
  to_team_id UUID REFERENCES teams(id),
  offer_amount INTEGER NOT NULL,
  status transfer_status DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- SCOUTING_REPORTS
CREATE TABLE scouting_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_team_id UUID REFERENCES teams(id),
  target_player_id UUID REFERENCES players(id),
  level scout_level NOT NULL,
  cost_cr INTEGER NOT NULL,
  revealed_attributes JSONB DEFAULT '{}',
  status scout_status DEFAULT 'pending',
  completes_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- YOUTH_ACADEMY
CREATE TABLE youth_academy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) UNIQUE,
  is_active BOOLEAN DEFAULT FALSE,
  weekly_cost INTEGER DEFAULT 1000,
  activated_at TIMESTAMPTZ,
  last_intake_at TIMESTAMPTZ
);

-- CMP_SHOP_ITEMS
CREATE TABLE cmp_shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  tier VARCHAR(20) NOT NULL, -- 'bronze', 'silver', 'gold'
  cmp_cost INTEGER NOT NULL,
  item_type VARCHAR(50) NOT NULL, -- 'cr_bonus', 'player', 'scout_boost', etc.
  item_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE
);

-- CMP_PURCHASES
CREATE TABLE cmp_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  item_id UUID REFERENCES cmp_shop_items(id),
  cmp_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi datasını görebilir
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own data" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

-- Takımlar: Herkes görebilir, sadece sahibi değiştirebilir
CREATE POLICY "Anyone can view teams" ON teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can modify team" ON teams FOR ALL USING (auth.uid() = user_id);

-- Oyuncular: Herkes görebilir (stat'lar scouting ile açılır — uygulama katmanında kontrol)
CREATE POLICY "Anyone can view players" ON players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can modify players" ON players FOR ALL USING (
  EXISTS (SELECT 1 FROM teams t WHERE t.id = players.team_id AND t.user_id = auth.uid())
);
