import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { CompetitionConfig, GameSnapshot, LiveMatchData, TeamInfo } from '../models/types.ts';

function formatSql(sql: string, params?: any[]): string {
  if (!params || params.length === 0) return sql;
  return sql.replace(/\$(\d+)/g, (match, p1) => {
    const idx = parseInt(p1, 10) - 1;
    if (idx < 0 || idx >= params.length) return match;
    const val = params[idx];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return Number.isFinite(val) ? val.toString() : 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val instanceof Date) return `'${val.toISOString()}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
  });
}

class DatabaseService {
  private db: any;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized) return;
    try {
      this.db = newDb();
      const schemaPath = path.join(process.cwd(), 'backend', 'database', 'schema.sql');
      let schemaSql = '';
      if (fs.existsSync(schemaPath)) {
        schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      } else {
        // Fallback inline schema
        schemaSql = `
          CREATE TABLE IF NOT EXISTS competitions (
              id VARCHAR(50) PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              slug VARCHAR(50),
              country VARCHAR(50),
              is_active BOOLEAN DEFAULT true,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS teams (
              id VARCHAR(50) PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              short_name VARCHAR(50),
              abbreviation VARCHAR(10),
              logo_url TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS games (
              id VARCHAR(50) PRIMARY KEY,
              competition_id VARCHAR(50),
              home_team_id VARCHAR(50),
              away_team_id VARCHAR(50),
              status VARCHAR(20) NOT NULL,
              minute INT DEFAULT 0,
              clock VARCHAR(20),
              start_time TIMESTAMP,
              home_score INT DEFAULT 0,
              away_score INT DEFAULT 0,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS game_snapshots (
              id SERIAL PRIMARY KEY,
              game_id VARCHAR(50) NOT NULL,
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
          CREATE TABLE IF NOT EXISTS odds (
              id SERIAL PRIMARY KEY,
              game_id VARCHAR(50) NOT NULL,
              timestamp TIMESTAMP NOT NULL,
              provider VARCHAR(50),
              market VARCHAR(50) NOT NULL,
              line REAL NOT NULL,
              odds_home REAL,
              odds_away REAL,
              over_odds REAL,
              under_odds REAL
          );
          CREATE TABLE IF NOT EXISTS signals (
              id SERIAL PRIMARY KEY,
              game_id VARCHAR(50) NOT NULL,
              timestamp TIMESTAMP NOT NULL,
              minute INT NOT NULL,
              tab_type VARCHAR(30) NOT NULL,
              target_over REAL NOT NULL,
              target_odd REAL,
              reference_odd REAL NOT NULL,
              is_above_ref BOOLEAN DEFAULT false,
              intensity_tag VARCHAR(30) NOT NULL,
              xg_15 REAL,
              xg_10 REAL,
              xg_5 REAL
          );
        `;
      }
      this.db.public.none(schemaSql);
      this.isInitialized = true;
      console.log('[PostgreSQL Engine] In-memory database initialized with standard schema.');
    } catch (err: any) {
      console.error('[PostgreSQL Engine] Init error:', err.message);
    }
  }

  public none(sql: string, params?: any[]): void {
    const formatted = formatSql(sql, params);
    this.db.public.none(formatted);
  }

  public many(sql: string, params?: any[]): any[] {
    const formatted = formatSql(sql, params);
    try {
      return this.db.public.many(formatted) || [];
    } catch (err) {
      return [];
    }
  }

  public oneOrNone(sql: string, params?: any[]): any | null {
    const rows = this.many(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public upsertCompetition(comp: CompetitionConfig) {
    try {
      this.none(
        `INSERT INTO competitions (id, name, slug, country, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, country = EXCLUDED.country`,
        [comp.id, comp.name, comp.slug, comp.country, comp.isActive]
      );
    } catch (e: any) {
      console.error('[PostgreSQL Engine] Upsert competition error:', e?.message || e);
    }
  }

  public getCompetitions(): CompetitionConfig[] {
    try {
      return this.many(`SELECT id, name, slug, country, is_active as "isActive" FROM competitions`);
    } catch (e) {
      return [];
    }
  }

  public toggleCompetition(id: string, active: boolean) {
    try {
      this.none(`UPDATE competitions SET is_active = $1 WHERE id = $2`, [active, id]);
    } catch (e: any) {
      console.error('Failed to toggle competition', e?.message || e);
    }
  }

  public upsertTeam(team: TeamInfo) {
    try {
      this.none(
        `INSERT INTO teams (id, name, short_name, abbreviation, logo_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, short_name = EXCLUDED.short_name, abbreviation = EXCLUDED.abbreviation, logo_url = EXCLUDED.logo_url`,
        [team.id, team.name, team.shortName, team.abbreviation, team.logoUrl || null]
      );
    } catch (e: any) {
      console.error('[PostgreSQL Engine] Upsert team error:', e?.message || e);
    }
  }

  public saveGame(match: LiveMatchData) {
    try {
      this.upsertTeam(match.homeTeam);
      this.upsertTeam(match.awayTeam);

      this.none(
        `INSERT INTO games (id, competition_id, home_team_id, away_team_id, status, minute, clock, home_score, away_score) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           minute = EXCLUDED.minute,
           clock = EXCLUDED.clock,
           home_score = EXCLUDED.home_score,
           away_score = EXCLUDED.away_score,
           updated_at = CURRENT_TIMESTAMP`,
        [match.id, match.competitionId, match.homeTeam.id, match.awayTeam.id, match.statusState, match.minute, match.displayClock, match.homeScore, match.awayScore]
      );
    } catch (e: any) {
      console.error('[PostgreSQL Engine] Error saving game:', e?.message || e);
    }
  }

  public ensureGameExists(
    gameId: string,
    competitionId: string,
    homeTeam: TeamInfo,
    awayTeam: TeamInfo,
    statusState: string,
    minute: number,
    displayClock: string,
    homeScore: number,
    awayScore: number
  ) {
    try {
      this.upsertTeam(homeTeam);
      this.upsertTeam(awayTeam);

      this.none(
        `INSERT INTO games (id, competition_id, home_team_id, away_team_id, status, minute, clock, home_score, away_score) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           minute = EXCLUDED.minute,
           clock = EXCLUDED.clock,
           home_score = EXCLUDED.home_score,
           away_score = EXCLUDED.away_score,
           updated_at = CURRENT_TIMESTAMP`,
        [gameId, competitionId, homeTeam.id, awayTeam.id, statusState, minute, displayClock, homeScore, awayScore]
      );
    } catch (e: any) {
      console.error('[PostgreSQL Engine] Ensure game exists error:', e?.message || e);
    }
  }

  public insertSnapshot(snapshot: GameSnapshot) {
    try {
      this.none(
        `INSERT INTO game_snapshots 
         (game_id, timestamp, minute, home_score, away_score, home_xg, away_xg, total_xg, 
          home_shots, away_shots, home_shots_on_target, away_shots_on_target, home_shots_off_target, away_shots_off_target,
          home_shots_inside_box, away_shots_inside_box, home_big_chances, away_big_chances)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          snapshot.gameId,
          snapshot.timestamp,
          snapshot.minute,
          snapshot.homeScore,
          snapshot.awayScore,
          snapshot.homeXg,
          snapshot.awayXg,
          snapshot.totalXg,
          snapshot.homeShots,
          snapshot.awayShots,
          snapshot.homeShotsOnTarget,
          snapshot.awayShotsOnTarget,
          snapshot.homeShotsOffTarget,
          snapshot.awayShotsOffTarget,
          snapshot.homeShotsInsideBox,
          snapshot.awayShotsInsideBox,
          snapshot.homeBigChances,
          snapshot.awayBigChances,
        ]
      );
    } catch (err: any) {
      console.error('[PostgreSQL Engine] Error inserting snapshot:', err?.message || err);
    }
  }

  public getSnapshotsForGame(gameId: string, limit = 50): GameSnapshot[] {
    try {
      const rows = this.many(
        `SELECT id, game_id as "gameId", timestamp, minute, home_score as "homeScore", away_score as "awayScore",
                home_xg as "homeXg", away_xg as "awayXg", total_xg as "totalXg",
                home_shots as "homeShots", away_shots as "awayShots",
                home_shots_on_target as "homeShotsOnTarget", away_shots_on_target as "awayShotsOnTarget",
                home_shots_off_target as "homeShotsOffTarget", away_shots_off_target as "awayShotsOffTarget",
                home_shots_inside_box as "homeShotsInsideBox", away_shots_inside_box as "awayShotsInsideBox",
                home_big_chances as "homeBigChances", away_big_chances as "awayBigChances"
         FROM game_snapshots
         WHERE game_id = $1
         ORDER BY timestamp ASC
         LIMIT $2`,
        [gameId, limit]
      );
      return rows.map((r: any) => ({
        ...r,
        timestamp: typeof r.timestamp === 'string' ? r.timestamp : new Date(r.timestamp).toISOString(),
      }));
    } catch (err: any) {
      console.error('[PostgreSQL Engine] Error getting snapshots:', err?.message || err);
      return [];
    }
  }

  public recordSignal(signal: {
    gameId: string;
    minute: number;
    tabType: string;
    targetOver: number;
    targetOdd: number | null;
    referenceOdd: number;
    isAboveRef: boolean;
    intensityTag: string;
    xg15: number | null;
    xg10: number | null;
    xg5: number | null;
  }) {
    try {
      this.none(
        `INSERT INTO signals (game_id, timestamp, minute, tab_type, target_over, target_odd, reference_odd, is_above_ref, intensity_tag, xg_15, xg_10, xg_5)
         VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          signal.gameId,
          signal.minute,
          signal.tabType,
          signal.targetOver,
          signal.targetOdd,
          signal.referenceOdd,
          signal.isAboveRef,
          signal.intensityTag,
          signal.xg15,
          signal.xg10,
          signal.xg5,
        ]
      );
    } catch (err: any) {
      console.error('[PostgreSQL Engine] Error recording signal:', err?.message || err);
    }
  }
}

export const dbService = new DatabaseService();
