-- ==========================================================
-- ODDCERTA LIVE MONITOR - POSTGRESQL DATABASE SCHEMA
-- ==========================================================

-- 1. Competitions / Leagues
CREATE TABLE IF NOT EXISTS competitions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50),
    country VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Teams
CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    abbreviation VARCHAR(10),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Games / Matches
CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(50) PRIMARY KEY,
    competition_id VARCHAR(50) REFERENCES competitions(id),
    home_team_id VARCHAR(50) REFERENCES teams(id),
    away_team_id VARCHAR(50) REFERENCES teams(id),
    status VARCHAR(20) NOT NULL, -- 'in', 'pre', 'post'
    minute INT DEFAULT 0,
    clock VARCHAR(20),
    start_time TIMESTAMP,
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Game Snapshots (Time-series recording of live match states)
CREATE TABLE IF NOT EXISTS game_snapshots (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(50) NOT NULL REFERENCES games(id),
    timestamp TIMESTAMP NOT NULL,
    minute INT NOT NULL,
    home_score INT NOT NULL DEFAULT 0,
    away_score INT NOT NULL DEFAULT 0,
    home_xg REAL,
    away_xg REAL,
    total_xg REAL,
    home_shots INT,
    away_shots INT,
    home_shots_on_target INT,
    away_shots_on_target INT,
    home_shots_off_target INT,
    away_shots_off_target INT,
    home_shots_inside_box INT,
    away_shots_inside_box INT,
    home_big_chances INT,
    away_big_chances INT
);

CREATE INDEX IF NOT EXISTS idx_snapshots_game_ts ON game_snapshots(game_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_game_minute ON game_snapshots(game_id, minute);

-- 5. Game Statistics (Latest or accumulated aggregate)
CREATE TABLE IF NOT EXISTS game_statistics (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(50) NOT NULL REFERENCES games(id),
    timestamp TIMESTAMP NOT NULL,
    total_shots INT,
    shots_on_target INT,
    shots_off_target INT,
    shots_inside_box INT,
    big_chances INT,
    corners INT,
    possession_pct REAL,
    total_xg REAL
);

-- 6. Odds (Live and Closing lines per market)
CREATE TABLE IF NOT EXISTS odds (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(50) NOT NULL REFERENCES games(id),
    timestamp TIMESTAMP NOT NULL,
    provider VARCHAR(50),
    market VARCHAR(50) NOT NULL, -- e.g. 'over_under'
    line REAL NOT NULL,          -- e.g. 1.5, 2.5, 3.5, 4.5
    odds_home REAL,
    odds_away REAL,
    over_odds REAL,
    under_odds REAL
);

CREATE INDEX IF NOT EXISTS idx_odds_game_market_line ON odds(game_id, market, line);

-- 7. Signals (Computed Over target classification and intensity tags)
CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(50) NOT NULL REFERENCES games(id),
    timestamp TIMESTAMP NOT NULL,
    minute INT NOT NULL,
    tab_type VARCHAR(30) NOT NULL, -- 'over_limite', 'over_frente', 'over_longa'
    target_over REAL NOT NULL,
    target_odd REAL,
    reference_odd REAL NOT NULL,
    is_above_ref BOOLEAN DEFAULT false,
    intensity_tag VARCHAR(30) NOT NULL, -- 'MEGA_HOT', 'HOT', 'NORMAL'
    xg_15 REAL,
    xg_10 REAL,
    xg_5 REAL
);

CREATE INDEX IF NOT EXISTS idx_signals_game_tab ON signals(game_id, tab_type, timestamp DESC);
