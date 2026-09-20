import { dbService } from '../database/db.ts';
import { GameSnapshot, IntensityLevel, LiveMatchData, MatchHistoricalProbability, SystemSettings, TabType } from '../models/types.ts';
import { EspnProvider } from '../providers/espn.ts';
import { RawMatchSummary, SoccerDataProvider } from '../providers/types.ts';
import { historyService } from './history.ts';
import { signalsService } from './signals.ts';
import { statisticsService } from './statistics.ts';
import { suggestionsService } from './suggestions.ts';

class GamesService {
  private provider: SoccerDataProvider = new EspnProvider();
  private cachedMatches: Map<string, LiveMatchData> = new Map();
  private lastFetchTime = 0;
  private settings: SystemSettings = {
    pollIntervalSeconds: 60,
    isAutoRefreshActive: true,
    overLimiteRefOdd: 2.0,
    overFrenteRefOdd: 3.0,
    overLongaRefOdd: 3.0,
    lastPollTimestamp: null,
    activeProvider: 'ESPN Public API',
  };
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const comps = await this.provider.getCompetitions();
      comps.forEach(c => dbService.upsertCompetition(c));
    } catch (e: any) {
      console.error('[ESPN] Failed initializing competitions:', e?.message || e);
    }
    this.startPolling();
  }

  public async ensureInitialPoll(): Promise<void> {
    if (this.cachedMatches.size === 0) {
      await this.pollMatches();
    }
  }

  public getSettings(): SystemSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<SystemSettings>): SystemSettings {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.pollIntervalSeconds !== undefined || newSettings.isAutoRefreshActive !== undefined) {
      this.restartPolling();
    }
    return this.getSettings();
  }

  public restartPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.startPolling();
  }

  private startPolling() {
    if (!this.settings.isAutoRefreshActive) return;
    const intervalMs = Math.max(5, this.settings.pollIntervalSeconds) * 1000;

    // Immediate initial poll
    this.pollMatches();

    this.pollTimer = setInterval(() => {
      this.pollMatches();
    }, intervalMs);
  }

  public async pollMatches(): Promise<LiveMatchData[]> {
    if (this.isPolling) {
      return Array.from(this.cachedMatches.values());
    }
    this.isPolling = true;

    try {
      console.log('[ESPN] Requesting scoreboard...');
      const activeCompetitions = dbService.getCompetitions()
        .filter(c => c.isActive)
        .map(c => c.id);

      // Fetch exclusively from real ESPN endpoints
      const rawMatches = await this.provider.getLiveMatches(activeCompetitions);
      console.log('[ESPN] HTTP 200');
      console.log(`[ESPN] ${rawMatches.length} games received`);

      const liveMatches = rawMatches.filter(m => m.state === 'in');
      console.log(`[ESPN] ${liveMatches.length} live games`);
      console.log('[ESPN] Parsing game statistics...');
      console.log('[ESPN] Parsing odds...');

      const processedMatches: LiveMatchData[] = [];
      const nowIso = new Date().toISOString();

      // Update cached matches with real ESPN data
      this.cachedMatches.clear();

      // Process in-play matches in parallel
      const liveRaws = rawMatches.filter(raw => raw.state !== 'post' && raw.state !== 'pre');
      const processedPromises = liveRaws.map(raw => this.processRawMatch(raw, nowIso));
      const processedResults = await Promise.all(processedPromises);

      for (const processed of processedResults) {
        if (processed) {
          processedMatches.push(processed);
          this.cachedMatches.set(processed.id, processed);
          dbService.saveGame(processed);
        }
      }

      // Automatically evaluate suggestions and audit results
      try {
        suggestionsService.evaluateMatches(processedMatches, rawMatches);
      } catch (sugErr: any) {
        console.error('[GamesService] Error evaluating suggestions:', sugErr?.message || sugErr);
      }

      console.log('[ESPN] Database updated');
      this.settings.lastPollTimestamp = nowIso;
      this.lastFetchTime = Date.now();
      return processedMatches;
    } catch (err: any) {
      console.error('[ESPN] Request failed:', err?.message || err);
      console.error('[ESPN] No mock fallback enabled');
      return Array.from(this.cachedMatches.values());
    } finally {
      this.isPolling = false;
    }
  }

  private async processRawMatch(raw: RawMatchSummary, nowIso: string): Promise<LiveMatchData | null> {
    const minute = raw.minute;
    const totalScore = raw.homeTeam.score + raw.awayTeam.score;
    const tab = signalsService.classifyTab(minute);

    // Ensure game and teams exist in PostgreSQL before snapshots or signals reference it
    dbService.ensureGameExists(
      raw.id,
      raw.competitionId,
      raw.homeTeam,
      raw.awayTeam,
      raw.state,
      minute,
      raw.displayClock,
      raw.homeTeam.score,
      raw.awayTeam.score
    );

    // Get previous snapshots from PostgreSQL to compute real delta
    const existingSnapshots = dbService.getSnapshotsForGame(raw.id, 50);

    // Parse accumulated stats from real boxscore
    const accumulated = statisticsService.parseAccumulatedStats(raw);
    const { home: homeStats, away: awayStats } = statisticsService.parseTeamDetailedStats(raw);

    // Create current snapshot with real values
    const currentSnapshot: GameSnapshot = {
      gameId: raw.id,
      timestamp: nowIso,
      minute,
      homeScore: raw.homeTeam.score,
      awayScore: raw.awayTeam.score,
      homeXg: homeStats.xg,
      awayXg: awayStats.xg,
      totalXg: accumulated.xg,
      homeShots: homeStats.totalShots,
      awayShots: awayStats.totalShots,
      homeShotsOnTarget: homeStats.shotsOnTarget,
      awayShotsOnTarget: awayStats.shotsOnTarget,
      homeShotsOffTarget: homeStats.shotsOffTarget,
      awayShotsOffTarget: awayStats.shotsOffTarget,
      homeShotsInsideBox: homeStats.shotsInsideBox,
      awayShotsInsideBox: awayStats.shotsInsideBox,
      homeBigChances: homeStats.bigChances,
      awayBigChances: awayStats.bigChances,
    };

    // Store snapshot to PostgreSQL
    dbService.insertSnapshot(currentSnapshot);

    const allSnapshots = [...existingSnapshots, currentSnapshot];

    // Compute recent stats using real snapshot deltas or real commentary plays
    const recent10 = statisticsService.computeRecentStats(raw, accumulated, allSnapshots, 10);
    const recent15 = statisticsService.computeRecentStats(raw, accumulated, allSnapshots, 15);
    const recent5 = statisticsService.computeRecentStats(raw, accumulated, allSnapshots, 5);

    const r5Teams = statisticsService.computeRecentStatsByTeam(raw, allSnapshots, 5);
    const r10Teams = statisticsService.computeRecentStatsByTeam(raw, allSnapshots, 10);
    const r15Teams = statisticsService.computeRecentStatsByTeam(raw, allSnapshots, 15);

    // Compute Target Over and real found odd
    const targetOver = signalsService.computeTargetOver(tab, totalScore, raw.oddsList, minute, accumulated.xg);

    // Calculate historical probability for the target line strictly on past games of same competition/season
    let history: MatchHistoricalProbability | undefined = undefined;
    try {
      history = await historyService.computeHistoricalProbability(
        raw.competitionId,
        raw.competitionName,
        {
          id: raw.homeTeam.id,
          name: raw.homeTeam.name,
          shortName: raw.homeTeam.shortName,
          abbreviation: raw.homeTeam.abbreviation,
          logoUrl: raw.homeTeam.logoUrl,
        },
        {
          id: raw.awayTeam.id,
          name: raw.awayTeam.name,
          shortName: raw.awayTeam.shortName,
          abbreviation: raw.awayTeam.abbreviation,
          logoUrl: raw.awayTeam.logoUrl,
        },
        targetOver.targetLine,
        raw.id
      );
    } catch (hErr: any) {
      console.warn(`[GamesService] Error computing history for game ${raw.id}:`, hErr?.message || hErr);
    }

    // Calculate recent goal info to identify post-goal artifacts vs pure pre-goal pressure
    let lastGoalMinute: number | null = null;
    if (raw.events && raw.events.length > 0) {
      const goalEvents = raw.events.filter(
        (e) => e.type === 'goal' || e.shortText?.toLowerCase().includes('goal') || e.text?.toLowerCase().includes('goal')
      );
      if (goalEvents.length > 0) {
        lastGoalMinute = Math.max(...goalEvents.map((g) => g.minute));
      }
    }
    if (lastGoalMinute === null && allSnapshots.length >= 2) {
      const sortedSnaps = [...allSnapshots].sort((a, b) => a.minute - b.minute);
      for (let i = sortedSnaps.length - 1; i > 0; i--) {
        const prev = sortedSnaps[i - 1];
        const curr = sortedSnaps[i];
        if (curr.homeScore + curr.awayScore > prev.homeScore + prev.awayScore) {
          lastGoalMinute = curr.minute;
          break;
        }
      }
    }

    const minutesSinceLastGoal = lastGoalMinute !== null ? Math.max(0, minute - lastGoalMinute) : null;
    const hasRecentGoal = lastGoalMinute !== null && minutesSinceLastGoal !== null && minutesSinceLastGoal <= 12;

    // Evaluate Intensity based on real xG deltas, historical Over rate, and recent goal filtering
    const intensity = signalsService.evaluateIntensity(
      recent15.xg,
      recent10.xg,
      recent5.xg,
      history,
      targetOver.targetLine,
      {
        hasRecentGoal,
        goalMinute: lastGoalMinute,
        minutesSinceLastGoal,
      }
    );

    // Record signal in DB
    dbService.recordSignal({
      gameId: raw.id,
      minute,
      tabType: tab,
      targetOver: targetOver.targetLine,
      targetOdd: targetOver.foundOdd,
      referenceOdd: targetOver.referenceOdd,
      isAboveRef: targetOver.isAboveReference,
      intensityTag: intensity.primaryTag,
      xg15: intensity.xg15,
      xg10: intensity.xg10,
      xg5: intensity.xg5,
    });

    return {
      id: raw.id,
      competitionId: raw.competitionId,
      competitionName: raw.competitionName,
      homeTeam: {
        id: raw.homeTeam.id,
        name: raw.homeTeam.name,
        shortName: raw.homeTeam.shortName,
        abbreviation: raw.homeTeam.abbreviation,
        logoUrl: raw.homeTeam.logoUrl,
      },
      awayTeam: {
        id: raw.awayTeam.id,
        name: raw.awayTeam.name,
        shortName: raw.awayTeam.shortName,
        abbreviation: raw.awayTeam.abbreviation,
        logoUrl: raw.awayTeam.logoUrl,
      },
      homeScore: raw.homeTeam.score,
      awayScore: raw.awayTeam.score,
      totalScore,
      minute,
      displayClock: raw.displayClock,
      statusState: raw.state,
      statusDetail: raw.statusDetail,
      tab,
      targetOver,
      intensity,
      homeStats,
      awayStats,
      recent5Home: r5Teams.home,
      recent5Away: r5Teams.away,
      recent10Home: r10Teams.home,
      recent10Away: r10Teams.away,
      recent15Home: r15Teams.home,
      recent15Away: r15Teams.away,
      accumulated,
      recent10,
      recent15,
      recent5,
      snapshotsCount: allSnapshots.length,
      snapshots: allSnapshots.slice(-15),
      history,
      events: raw.events || [],
      timeline15m: statisticsService.extractRecentTimeline(raw, 15),
      lastUpdated: nowIso,
    };
  }

  public getMatches(filters: {
    tab?: TabType;
    intensity?: IntensityLevel | 'ALL';
    sortBy?: 'relevance' | 'minute' | 'odd' | 'xg15' | 'xg10' | 'xg5' | 'recent_shots' | 'recent_sot' | 'recent_big_chances';
    sortOrder?: 'asc' | 'desc';
  }): LiveMatchData[] {
    let list = Array.from(this.cachedMatches.values());

    // Filter by tab
    if (filters.tab && filters.tab !== 'all') {
      list = list.filter(m => m.tab === filters.tab);
    }

    // Filter by intensity
    if (filters.intensity && filters.intensity !== 'ALL') {
      list = list.filter(m => m.intensity.primaryTag === filters.intensity);
    }

    // Sorting
    const sortField = filters.sortBy || 'relevance';
    const sortOrder = filters.sortOrder || 'desc';
    const factor = sortOrder === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      if (sortField === 'relevance') {
        // 1. Mega Hot (rank 3), 2. Hot (rank 2), 3. Normal (rank 1)
        const rankMap: Record<IntensityLevel, number> = {
          MEGA_HOT: 3,
          HOT: 2,
          NORMAL: 1,
        };
        const rankA = rankMap[a.intensity.primaryTag] || 1;
        const rankB = rankMap[b.intensity.primaryTag] || 1;
        if (rankA !== rankB) {
          return (rankA - rankB) * factor;
        }

        // Within same group: highest recent xG first
        const maxRecentXgA = Math.max(a.intensity.xg10 || 0, a.intensity.xg15 || 0, a.intensity.xg5 || 0);
        const maxRecentXgB = Math.max(b.intensity.xg10 || 0, b.intensity.xg15 || 0, b.intensity.xg5 || 0);
        return (maxRecentXgA - maxRecentXgB) * factor;
      }

      let valA = 0;
      let valB = 0;

      switch (sortField) {
        case 'minute':
          valA = a.minute;
          valB = b.minute;
          break;
        case 'odd':
          valA = a.targetOver.foundOdd || 0;
          valB = b.targetOver.foundOdd || 0;
          break;
        case 'xg15':
          valA = a.intensity.xg15 || 0;
          valB = b.intensity.xg15 || 0;
          break;
        case 'xg10':
          valA = a.intensity.xg10 || 0;
          valB = b.intensity.xg10 || 0;
          break;
        case 'xg5':
          valA = a.intensity.xg5 || 0;
          valB = b.intensity.xg5 || 0;
          break;
        case 'recent_shots':
          valA = a.recent10.totalShots || 0;
          valB = b.recent10.totalShots || 0;
          break;
        case 'recent_sot':
          valA = a.recent10.shotsOnTarget || 0;
          valB = b.recent10.shotsOnTarget || 0;
          break;
        case 'recent_big_chances':
          valA = a.recent10.bigChances || 0;
          valB = b.recent10.bigChances || 0;
          break;
      }

      return (valA - valB) * factor;
    });

    return list;
  }

  public getMatchById(id: string): LiveMatchData | undefined {
    return this.cachedMatches.get(id);
  }

  public async getMatchHistoricalProbability(
    matchId: string,
    customLine?: number
  ): Promise<MatchHistoricalProbability | null> {
    const match = this.cachedMatches.get(matchId);
    if (!match) return null;

    const lineToUse = customLine !== undefined ? customLine : match.targetOver.targetLine;
    return historyService.computeHistoricalProbability(
      match.competitionId,
      match.competitionName,
      match.homeTeam,
      match.awayTeam,
      lineToUse,
      match.id
    );
  }
}

export const gamesService = new GamesService();
