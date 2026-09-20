import { EspnProvider } from '../../backend/providers/espn.ts';
import { SignalsService } from '../../backend/services/signals.ts';
import { StatisticsService } from '../../backend/services/statistics.ts';
import { HistoryService } from '../../backend/services/history.ts';
import {
  CompetitionConfig,
  GameSnapshot,
  IntensityLevel,
  LiveMatchData,
  LiveSuggestionItem,
  MatchHistoricalProbability,
  SuggestionCriteriaConfig,
  SuggestionStatus,
  SuggestionsSummary,
  SuggestionType,
  SystemSettings,
  TabType,
} from '../types.ts';
import { RawMatchSummary } from '../../backend/providers/types.ts';

const DEFAULT_CRITERIA: SuggestionCriteriaConfig = {
  unilateralMinXgDiff: 0.20,
  unilateralMinDominantXg: 0.20,
  unilateralMaxOpponentXg: 0.00,
  unilateralDominanceRatio: 2.5,
  unilateralMinDominantShots: 2,
  unilateralMinDominantSot: 1,
  openGameMinMutualXg: 0.04,
  openGameMinCombinedXg: 0.12,
  openGameMinCombinedShots: 3,
  minMinute: 10,
  maxMinute: 88,
  minOddValue: 1.25,
};

const DEFAULT_SETTINGS: SystemSettings = {
  pollIntervalSeconds: 30,
  isAutoRefreshActive: true,
  overLimiteRefOdd: 2.0,
  overFrenteRefOdd: 3.0,
  overLongaRefOdd: 3.0,
  lastPollTimestamp: null,
  activeProvider: 'ESPN Public API (Direto no Navegador)',
};

export class ClientGamesService {
  private provider = new EspnProvider();
  private signalsService = new SignalsService();
  private statisticsService = new StatisticsService();
  private historyService = new HistoryService();

  private cachedMatches: Map<string, LiveMatchData> = new Map();
  private snapshotsMap: Map<string, GameSnapshot[]> = new Map();
  private suggestions: Map<string, LiveSuggestionItem> = new Map();
  private criteria: SuggestionCriteriaConfig = { ...DEFAULT_CRITERIA };
  private settings: SystemSettings = { ...DEFAULT_SETTINGS };
  private competitions: CompetitionConfig[] = [];

  private isPolling = false;
  private lastFetchTime = 0;

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (typeof window === 'undefined') return;

    try {
      const savedCriteria = localStorage.getItem('oddcerta_sug_criteria');
      if (savedCriteria) {
        this.criteria = { ...DEFAULT_CRITERIA, ...JSON.parse(savedCriteria) };
      }

      const savedSettings = localStorage.getItem('oddcerta_settings');
      if (savedSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }

      const savedComps = localStorage.getItem('oddcerta_competitions');
      if (savedComps) {
        this.competitions = JSON.parse(savedComps);
      }

      const savedSug = localStorage.getItem('oddcerta_suggestions');
      if (savedSug) {
        const arr: LiveSuggestionItem[] = JSON.parse(savedSug);
        for (const item of arr) {
          this.suggestions.set(item.id, item);
        }
      }
    } catch (e) {
      console.warn('[ClientGamesService] Error loading localStorage state:', e);
    }
  }

  private saveSuggestions() {
    if (typeof window === 'undefined') return;
    try {
      const list = Array.from(this.suggestions.values()).slice(-100);
      localStorage.setItem('oddcerta_suggestions', JSON.stringify(list));
    } catch (e) {
      console.warn('[ClientGamesService] Error saving suggestions to localStorage:', e);
    }
  }

  public async getCompetitions(): Promise<CompetitionConfig[]> {
    if (this.competitions.length === 0) {
      this.competitions = await this.provider.getCompetitions();
      if (typeof window !== 'undefined') {
        localStorage.setItem('oddcerta_competitions', JSON.stringify(this.competitions));
      }
    }
    return this.competitions;
  }

  public async toggleCompetition(id: string, isActive: boolean): Promise<void> {
    const list = await this.getCompetitions();
    const target = list.find((c) => c.id === id);
    if (target) {
      target.isActive = isActive;
      if (typeof window !== 'undefined') {
        localStorage.setItem('oddcerta_competitions', JSON.stringify(list));
      }
    }
  }

  public getSettings(): SystemSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<SystemSettings>): SystemSettings {
    this.settings = { ...this.settings, ...partial };
    if (typeof window !== 'undefined') {
      localStorage.setItem('oddcerta_settings', JSON.stringify(this.settings));
    }
    return this.getSettings();
  }

  public getCriteria(): SuggestionCriteriaConfig {
    return { ...this.criteria };
  }

  public updateCriteria(partial: Partial<SuggestionCriteriaConfig>): SuggestionCriteriaConfig {
    this.criteria = { ...this.criteria, ...partial };
    if (typeof window !== 'undefined') {
      localStorage.setItem('oddcerta_sug_criteria', JSON.stringify(this.criteria));
    }
    return this.getCriteria();
  }

  public async pollMatches(): Promise<LiveMatchData[]> {
    if (this.isPolling) {
      return Array.from(this.cachedMatches.values());
    }
    this.isPolling = true;

    try {
      const comps = await this.getCompetitions();
      const activeIds = comps.filter((c) => c.isActive).map((c) => c.id);

      const rawMatches = await this.provider.getLiveMatches(activeIds);
      const nowIso = new Date().toISOString();

      const liveRaws = rawMatches.filter((raw) => raw.state !== 'post' && raw.state !== 'pre');
      const processedPromises = liveRaws.map((raw) => this.processRawMatch(raw, nowIso));
      const processedResults = await Promise.all(processedPromises);

      this.cachedMatches.clear();
      const processedMatches: LiveMatchData[] = [];

      for (const processed of processedResults) {
        if (processed) {
          processedMatches.push(processed);
          this.cachedMatches.set(processed.id, processed);
        }
      }

      // Evaluate suggestions
      this.evaluateSuggestions(processedMatches, rawMatches);

      this.settings.lastPollTimestamp = nowIso;
      this.lastFetchTime = Date.now();
      return processedMatches;
    } catch (err) {
      console.error('[ClientGamesService] Error during live poll:', err);
      return Array.from(this.cachedMatches.values());
    } finally {
      this.isPolling = false;
    }
  }

  private async processRawMatch(raw: RawMatchSummary, nowIso: string): Promise<LiveMatchData | null> {
    const minute = raw.minute;
    const totalScore = raw.homeTeam.score + raw.awayTeam.score;
    const tab = this.signalsService.classifyTab(minute);

    const accumulated = this.statisticsService.parseAccumulatedStats(raw);
    const { home: homeStats, away: awayStats } = this.statisticsService.parseTeamDetailedStats(raw);

    const existingSnapshots = this.snapshotsMap.get(raw.id) || [];
    const currentSnapshot: GameSnapshot = {
      gameId: raw.id,
      timestamp: nowIso,
      minute,
      homeScore: raw.homeTeam.score,
      awayScore: raw.awayTeam.score,
      homeXg: raw.homeXg,
      awayXg: raw.awayXg,
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

    const allSnapshots = [...existingSnapshots.slice(-49), currentSnapshot];
    this.snapshotsMap.set(raw.id, allSnapshots);

    const recent10 = this.statisticsService.computeRecentStats(raw, accumulated, allSnapshots, 10);
    const recent15 = this.statisticsService.computeRecentStats(raw, accumulated, allSnapshots, 15);
    const recent5 = this.statisticsService.computeRecentStats(raw, accumulated, allSnapshots, 5);

    const r5Teams = this.statisticsService.computeRecentStatsByTeam(raw, allSnapshots, 5);
    const r10Teams = this.statisticsService.computeRecentStatsByTeam(raw, allSnapshots, 10);
    const r15Teams = this.statisticsService.computeRecentStatsByTeam(raw, allSnapshots, 15);

    const targetOver = this.signalsService.computeTargetOver(tab, totalScore, raw.oddsList, minute, accumulated.xg);

    let history: MatchHistoricalProbability | undefined = undefined;
    try {
      history = await this.historyService.computeHistoricalProbability(
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
    } catch (hErr) {
      console.warn(`[ClientGamesService] Error computing history for game ${raw.id}:`, hErr);
    }

    const intensity = this.signalsService.evaluateIntensity(
      recent15.xg,
      recent10.xg,
      recent5.xg,
      history,
      targetOver.targetLine
    );

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
      lastUpdated: nowIso,
    };
  }

  private evaluateSuggestions(liveMatches: LiveMatchData[], rawMatches?: RawMatchSummary[]) {
    const nowIso = new Date().toISOString();

    for (const match of liveMatches) {
      if (match.statusState !== 'in') continue;
      if (match.minute < this.criteria.minMinute || match.minute > this.criteria.maxMinute) continue;

      const h15 = match.recent15Home?.xg ?? 0;
      const h10 = match.recent10Home?.xg ?? 0;
      const h5 = match.recent5Home?.xg ?? 0;
      const hMax = Math.max(h15, h10, h5);

      const a15 = match.recent15Away?.xg ?? 0;
      const a10 = match.recent10Away?.xg ?? 0;
      const a5 = match.recent5Away?.xg ?? 0;
      const aMax = Math.max(a15, a10, a5);

      const hShots = (match.recent15Home?.totalShots || 0) + (match.recent10Home?.totalShots || 0);
      const aShots = (match.recent15Away?.totalShots || 0) + (match.recent10Away?.totalShots || 0);
      const hSot = (match.recent15Home?.shotsOnTarget || 0) + (match.recent10Home?.shotsOnTarget || 0);
      const aSot = (match.recent15Away?.shotsOnTarget || 0) + (match.recent10Away?.shotsOnTarget || 0);

      let hVal = hMax;
      let aVal = aMax;
      if (hMax === 0 && aMax === 0) {
        const totalXgH = match.homeStats?.xg ?? 0;
        const totalXgA = match.awayStats?.xg ?? 0;
        if (totalXgH > 0 || totalXgA > 0) {
          hVal = parseFloat((totalXgH * 0.20).toFixed(2));
          aVal = parseFloat((totalXgA * 0.20).toFixed(2));
        }
      }

      const hDiff = parseFloat((hVal - aVal).toFixed(2));
      const aDiff = parseFloat((aVal - hVal).toFixed(2));

      // 1. Lá e Cá
      const isBothHighXg =
        (hVal >= this.criteria.openGameMinMutualXg && aVal >= this.criteria.openGameMinMutualXg) ||
        (hVal + aVal >= this.criteria.openGameMinCombinedXg && hVal > 0.02 && aVal > 0.02) ||
        (hShots + aShots >= this.criteria.openGameMinCombinedShots && hVal >= 0.03 && aVal >= 0.03);

      if (isBothHighXg) {
        const sugId = `sug_${match.id}_open_${match.homeScore}_${match.awayScore}`;
        if (!this.suggestions.has(sugId)) {
          const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
          const awayLabel = match.awayTeam.shortName || match.awayTeam.name;
          const triggerReason = `Jogo Aberto: xG ${homeLabel} (+${hVal.toFixed(2)}) e xG ${awayLabel} (+${aVal.toFixed(2)}) mútuos | Soma xG: +${(hVal + aVal).toFixed(2)}`;

          const item: LiveSuggestionItem = {
            id: sugId,
            gameId: match.id,
            competitionName: match.competitionName,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            minute: match.minute,
            scoreAtTime: { home: match.homeScore, away: match.awayScore },
            currentScore: { home: match.homeScore, away: match.awayScore },
            type: 'OVER_OPEN_GAME',
            typeLabel: 'Lá e Cá (Jogo Aberto)',
            targetLine: match.targetOver.targetLine,
            odd: match.targetOver.foundOdd || match.targetOver.referenceOdd || 2.0,
            marketDescription: `Over ${match.targetOver.targetLine} Gols`,
            suggestionText: `Jogo Aberto entre ${match.homeTeam.name} e ${match.awayTeam.name}. Ambas as equipes estão gerando perigo. Sugestão: Over ${match.targetOver.targetLine}`,
            triggerReason,
            xgDiff: parseFloat((hVal + aVal).toFixed(2)),
            status: 'PENDENTE',
            createdAt: nowIso,
            metrics: {
              homeXg15: h15,
              awayXg15: a15,
              homeXg10: h10,
              awayXg10: a10,
              homeXg5: h5,
              awayXg5: a5,
              totalXg: match.accumulated.xg,
              recentShotsHome: hShots,
              recentShotsAway: aShots,
              recentSotHome: hSot,
              recentSotAway: aSot,
            },
          };
          this.suggestions.set(sugId, item);
        }
      }

      // 2. Pressão Unilateral
      const isHomeDominant =
        (hDiff >= this.criteria.unilateralMinXgDiff && aVal <= this.criteria.unilateralMaxOpponentXg) ||
        (hVal >= this.criteria.unilateralMinDominantXg &&
          (aVal === 0 || hVal / Math.max(0.01, aVal) >= this.criteria.unilateralDominanceRatio));

      const isAwayDominant =
        (aDiff >= this.criteria.unilateralMinXgDiff && hVal <= this.criteria.unilateralMaxOpponentXg) ||
        (aVal >= this.criteria.unilateralMinDominantXg &&
          (hVal === 0 || aVal / Math.max(0.01, hVal) >= this.criteria.unilateralDominanceRatio));

      if (isHomeDominant && !isAwayDominant) {
        const sugId = `sug_${match.id}_uni_h_${match.homeScore}_${match.awayScore}`;
        if (!this.suggestions.has(sugId)) {
          const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
          const awayLabel = match.awayTeam.shortName || match.awayTeam.name;
          const triggerReason = `xG ${homeLabel} (+${hVal.toFixed(2)}) - xG ${awayLabel} (${aVal.toFixed(2)}) = +${hDiff.toFixed(2)} | xG ${awayLabel} = ${aVal.toFixed(2)}`;

          const item: LiveSuggestionItem = {
            id: sugId,
            gameId: match.id,
            competitionName: match.competitionName,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            minute: match.minute,
            scoreAtTime: { home: match.homeScore, away: match.awayScore },
            currentScore: { home: match.homeScore, away: match.awayScore },
            type: 'UNILATERAL_HOME',
            typeLabel: 'Pressão Unilateral',
            dominantTeam: 'home',
            dominantTeamName: match.homeTeam.name,
            odd: match.targetOver.foundOdd,
            marketDescription: `Back ${match.homeTeam.name} / Lay ${match.awayTeam.name}`,
            suggestionText: `O ${match.homeTeam.name} está pressionando intensamente o ${match.awayTeam.name}. Sugestão: Back ${match.homeTeam.name} ou Lay ${match.awayTeam.name}`,
            triggerReason,
            xgDiff: hDiff,
            status: 'PENDENTE',
            createdAt: nowIso,
            metrics: {
              homeXg15: h15,
              awayXg15: a15,
              homeXg10: h10,
              awayXg10: a10,
              homeXg5: h5,
              awayXg5: a5,
              totalXg: match.accumulated.xg,
              recentShotsHome: hShots,
              recentShotsAway: aShots,
              recentSotHome: hSot,
              recentSotAway: aSot,
            },
          };
          this.suggestions.set(sugId, item);
        }
      } else if (isAwayDominant && !isHomeDominant) {
        const sugId = `sug_${match.id}_uni_a_${match.homeScore}_${match.awayScore}`;
        if (!this.suggestions.has(sugId)) {
          const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
          const awayLabel = match.awayTeam.shortName || match.awayTeam.name;
          const triggerReason = `xG ${awayLabel} (+${aVal.toFixed(2)}) - xG ${homeLabel} (${hVal.toFixed(2)}) = +${aDiff.toFixed(2)} | xG ${homeLabel} = ${hVal.toFixed(2)}`;

          const item: LiveSuggestionItem = {
            id: sugId,
            gameId: match.id,
            competitionName: match.competitionName,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            minute: match.minute,
            scoreAtTime: { home: match.homeScore, away: match.awayScore },
            currentScore: { home: match.homeScore, away: match.awayScore },
            type: 'UNILATERAL_AWAY',
            typeLabel: 'Pressão Unilateral',
            dominantTeam: 'away',
            dominantTeamName: match.awayTeam.name,
            odd: match.targetOver.foundOdd,
            marketDescription: `Back ${match.awayTeam.name} / Lay ${match.homeTeam.name}`,
            suggestionText: `O ${match.awayTeam.name} está pressionando intensamente o ${match.homeTeam.name}. Sugestão: Back ${match.awayTeam.name} ou Lay ${match.homeTeam.name}`,
            triggerReason,
            xgDiff: aDiff,
            status: 'PENDENTE',
            createdAt: nowIso,
            metrics: {
              homeXg15: h15,
              awayXg15: a15,
              homeXg10: h10,
              awayXg10: a10,
              homeXg5: h5,
              awayXg5: a5,
              totalXg: match.accumulated.xg,
              recentShotsHome: hShots,
              recentShotsAway: aShots,
              recentSotHome: hSot,
              recentSotAway: aSot,
            },
          };
          this.suggestions.set(sugId, item);
        }
      }
    }

    // Resolve suggestions
    const liveMatchMap = new Map<string, LiveMatchData>();
    for (const m of liveMatches) {
      liveMatchMap.set(m.id, m);
    }
    const rawMatchMap = new Map<string, RawMatchSummary>();
    if (rawMatches) {
      for (const r of rawMatches) {
        rawMatchMap.set(r.id, r);
      }
    }

    for (const sug of this.suggestions.values()) {
      if (sug.status !== 'PENDENTE') continue;

      const liveM = liveMatchMap.get(sug.gameId);
      const rawM = rawMatchMap.get(sug.gameId);

      const currentHomeScore = liveM ? liveM.homeScore : rawM ? rawM.homeTeam.score : sug.currentScore.home;
      const currentAwayScore = liveM ? liveM.awayScore : rawM ? rawM.awayTeam.score : sug.currentScore.away;
      const isFinished = liveM ? liveM.statusState === 'post' : rawM ? rawM.state === 'post' : false;
      const currentMinute = liveM ? liveM.minute : rawM ? rawM.minute : sug.minute;

      sug.currentScore = { home: currentHomeScore, away: currentAwayScore };

      if (sug.type === 'UNILATERAL_HOME') {
        if (currentHomeScore > sug.scoreAtTime.home) {
          sug.status = 'GREEN';
          sug.resolvedAt = nowIso;
          sug.resolvedAtMinute = currentMinute;
          sug.resultNote = `Gol do ${sug.dominantTeamName || 'Mandante'} aos ${currentMinute}' (${currentHomeScore}x${currentAwayScore})`;
        } else if (isFinished) {
          sug.status = 'RED';
          sug.resolvedAt = nowIso;
          sug.resolvedAtMinute = currentMinute;
          sug.resultNote = `Jogo finalizado sem gol do Mandante (${currentHomeScore}x${currentAwayScore})`;
        }
      } else if (sug.type === 'UNILATERAL_AWAY') {
        if (currentAwayScore > sug.scoreAtTime.away) {
          sug.status = 'GREEN';
          sug.resolvedAt = nowIso;
          sug.resolvedAtMinute = currentMinute;
          sug.resultNote = `Gol do ${sug.dominantTeamName || 'Visitante'} aos ${currentMinute}' (${currentHomeScore}x${currentAwayScore})`;
        } else if (isFinished) {
          sug.status = 'RED';
          sug.resolvedAt = nowIso;
          sug.resolvedAtMinute = currentMinute;
          sug.resultNote = `Jogo finalizado sem gol do Visitante (${currentHomeScore}x${currentAwayScore})`;
        }
      } else if (sug.type === 'OVER_OPEN_GAME') {
        const targetLine = sug.targetLine ?? (sug.scoreAtTime.home + sug.scoreAtTime.away + 0.5);
        const totalGoals = currentHomeScore + currentAwayScore;
        if (totalGoals > targetLine) {
          sug.status = 'GREEN';
          sug.resolvedAt = nowIso;
          sug.resolvedAtMinute = currentMinute;
          sug.resultNote = `Linha batida aos ${currentMinute}' (${currentHomeScore}x${currentAwayScore})`;
        } else if (isFinished) {
          sug.status = 'RED';
          sug.resolvedAt = nowIso;
          sug.resolvedAtMinute = currentMinute;
          sug.resultNote = `Jogo finalizado sem bater a linha Over ${targetLine} (${currentHomeScore}x${currentAwayScore})`;
        }
      }
    }

    this.saveSuggestions();
  }

  public async getGames(params?: {
    tab?: string;
    intensity?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{
    success: boolean;
    data: LiveMatchData[];
    counts: {
      all: number;
      over_limite: number;
      over_frente: number;
      over_longa: number;
      mega_hot: number;
      hot: number;
    };
    settings: SystemSettings;
  }> {
    // If cache is empty or older than pollInterval, poll again
    const cacheTtl = Math.max(10, this.settings.pollIntervalSeconds) * 1000;
    if (this.cachedMatches.size === 0 || Date.now() - this.lastFetchTime > cacheTtl) {
      await this.pollMatches();
    }

    let list = Array.from(this.cachedMatches.values());

    if (params?.tab && params.tab !== 'all') {
      list = list.filter((m) => m.tab === params.tab);
    }

    if (params?.intensity && params.intensity !== 'ALL') {
      list = list.filter((m) => m.intensity.primaryTag === params.intensity);
    }

    const orderMultiplier = params?.sortOrder === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      switch (params?.sortBy) {
        case 'minute':
          return (a.minute - b.minute) * orderMultiplier;
        case 'odd': {
          const oddA = a.targetOver.foundOdd || a.targetOver.referenceOdd;
          const oddB = b.targetOver.foundOdd || b.targetOver.referenceOdd;
          return (oddA - oddB) * orderMultiplier;
        }
        case 'xg15': {
          const xgA = a.recent15?.xg || 0;
          const xgB = b.recent15?.xg || 0;
          return (xgB - xgA) * orderMultiplier;
        }
        case 'xg10': {
          const xgA = a.recent10?.xg || 0;
          const xgB = b.recent10?.xg || 0;
          return (xgB - xgA) * orderMultiplier;
        }
        case 'xg5': {
          const xgA = a.recent5?.xg || 0;
          const xgB = b.recent5?.xg || 0;
          return (xgB - xgA) * orderMultiplier;
        }
        case 'shotsOnTarget': {
          const sotA = a.accumulated.shotsOnTarget || 0;
          const sotB = b.accumulated.shotsOnTarget || 0;
          return (sotB - sotA) * orderMultiplier;
        }
        case 'bigChances': {
          const bcA = a.accumulated.bigChances || 0;
          const bcB = b.accumulated.bigChances || 0;
          return (bcB - bcA) * orderMultiplier;
        }
        default: {
          const intensityWeight: Record<IntensityLevel, number> = {
            MEGA_HOT: 3,
            HOT: 2,
            NORMAL: 1,
          };
          const wA = intensityWeight[a.intensity.primaryTag];
          const wB = intensityWeight[b.intensity.primaryTag];
          if (wA !== wB) return (wB - wA) * orderMultiplier;
          const xgRecentA = a.recent15?.xg || a.recent10?.xg || 0;
          const xgRecentB = b.recent15?.xg || b.recent10?.xg || 0;
          return (xgRecentB - xgRecentA) * orderMultiplier;
        }
      }
    });

    const allList = Array.from(this.cachedMatches.values());
    const counts = {
      all: allList.length,
      over_limite: allList.filter((m) => m.tab === 'over_limite').length,
      over_frente: allList.filter((m) => m.tab === 'over_frente').length,
      over_longa: allList.filter((m) => m.tab === 'over_longa').length,
      mega_hot: allList.filter((m) => m.intensity.primaryTag === 'MEGA_HOT').length,
      hot: allList.filter((m) => m.intensity.primaryTag === 'HOT').length,
    };

    return {
      success: true,
      data: list,
      counts,
      settings: this.getSettings(),
    };
  }

  public async getGameDetail(id: string): Promise<LiveMatchData> {
    const cached = this.cachedMatches.get(id);
    if (cached) return cached;
    await this.pollMatches();
    const found = this.cachedMatches.get(id);
    if (!found) throw new Error(`Game ${id} not found`);
    return found;
  }

  public async getGameHistory(id: string, line?: number): Promise<MatchHistoricalProbability> {
    const match = await this.getGameDetail(id);
    const targetLine = line !== undefined ? line : match.targetOver.targetLine;
    return await this.historyService.computeHistoricalProbability(
      match.competitionId,
      match.competitionName,
      match.homeTeam,
      match.awayTeam,
      targetLine,
      id
    );
  }

  public getSuggestions(params?: {
    status?: string;
    type?: string;
  }): { data: LiveSuggestionItem[]; summary: SuggestionsSummary } {
    let list = Array.from(this.suggestions.values());

    if (params?.status && params.status !== 'ALL') {
      list = list.filter((s) => s.status === params.status);
    }
    if (params?.type && params.type !== 'ALL') {
      list = list.filter((s) => s.type === params.type);
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const all = Array.from(this.suggestions.values());
    const green = all.filter((s) => s.status === 'GREEN').length;
    const red = all.filter((s) => s.status === 'RED').length;
    const pending = all.filter((s) => s.status === 'PENDENTE').length;
    const resolved = green + red;
    const winRate = resolved > 0 ? parseFloat(((green / resolved) * 100).toFixed(1)) : 0;

    return {
      data: list,
      summary: {
        total: all.length,
        greens: green,
        reds: red,
        pending,
        accuracyRate: winRate,
      },
    };
  }
}

export const clientGamesService = new ClientGamesService();
