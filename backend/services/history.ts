import {
  GoalDistribution,
  LineRateItem,
  MatchHistoricalProbability,
  TeamAuditMatchItem,
  TeamHistoricalPerformance,
  TeamInfo,
} from '../models/types.ts';

interface FinishedMatchRecord {
  matchId: string;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  opponentName: string;
  totalGoals: number;
  date: string;
}

interface CachedSchedule {
  timestamp: number;
  seasonYear?: number;
  events: any[];
}

export class HistoryService {
  private scheduleCache: Map<string, CachedSchedule> = new Map();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

  /**
   * Fetch team schedule from ESPN Public API with caching
   */
  private async fetchTeamSchedule(competitionId: string, teamId: string): Promise<CachedSchedule | null> {
    const cacheKey = `${competitionId}:${teamId}`;
    const cached = this.scheduleCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached;
    }

    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${competitionId}/teams/${teamId}/schedule`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      const entry: CachedSchedule = {
        timestamp: Date.now(),
        seasonYear: data.season?.year,
        events: data.events || [],
      };

      this.scheduleCache.set(cacheKey, entry);
      return entry;
    } catch (err) {
      console.warn(`[HistoryService] Failed to fetch schedule for team ${teamId} in ${competitionId}:`, (err as any)?.message);
      return null;
    }
  }

  /**
   * Filter matches strictly complying with rules:
   * - Same competition
   * - Same season
   * - Prior to current match
   * - Completed / Post state
   * - Not the current match itself
   */
  private filterFinishedMatches(
    events: any[],
    teamId: string,
    competitionId: string,
    currentMatchId?: string,
    currentMatchDate?: string,
    targetSeasonYear?: number
  ): FinishedMatchRecord[] {
    const results: FinishedMatchRecord[] = [];
    const compLower = competitionId.toLowerCase();
    const currentDateLimit = currentMatchDate ? new Date(currentMatchDate).getTime() : Date.now();

    for (const event of events) {
      // Must not be the current match
      if (currentMatchId && event.id === currentMatchId) {
        continue;
      }

      const compItem = event.competitions?.[0];
      if (!compItem) continue;

      // Completed / Finished check
      const statusType = compItem.status?.type;
      const isCompleted = statusType?.completed === true || statusType?.state === 'post' || statusType?.name === 'STATUS_FULL_TIME';
      if (!isCompleted) {
        continue;
      }

      // Date check: only matches BEFORE the current match
      if (event.date) {
        const eventTime = new Date(event.date).getTime();
        if (eventTime >= currentDateLimit) {
          continue;
        }
      }

      // Competition strict isolation: same league only (no cups, no friendlies)
      const eventLeagueSlug = (event.league?.slug || compItem.league?.slug || event.league?.midsizeName || '').toLowerCase();
      const eventLeagueId = (event.league?.id || compItem.league?.id || '').toLowerCase();

      const isSameCompetition =
        eventLeagueSlug === compLower ||
        eventLeagueSlug.includes(compLower) ||
        compLower.includes(eventLeagueSlug) ||
        eventLeagueId === compLower;

      if (!isSameCompetition && eventLeagueSlug !== '') {
        continue;
      }

      // Season check if known
      if (targetSeasonYear && event.season?.year && event.season.year !== targetSeasonYear) {
        continue;
      }

      // Identify competitors
      const competitors: any[] = compItem.competitors || [];
      const teamComp = competitors.find((c: any) => String(c.id) === String(teamId) || String(c.team?.id) === String(teamId));
      const oppComp = competitors.find((c: any) => c !== teamComp);

      if (!teamComp || !oppComp) {
        continue;
      }

      const isHome = teamComp.homeAway === 'home';
      const myScore = parseInt(teamComp.score?.displayValue ?? teamComp.score?.value ?? '0', 10);
      const oppScore = parseInt(oppComp.score?.displayValue ?? oppComp.score?.value ?? '0', 10);
      const opponentName =
        oppComp.team?.displayName || oppComp.team?.shortDisplayName || oppComp.team?.name || 'Adversário';

      results.push({
        matchId: event.id,
        isHome,
        teamScore: isNaN(myScore) ? 0 : myScore,
        opponentScore: isNaN(oppScore) ? 0 : oppScore,
        opponentName,
        totalGoals: (isNaN(myScore) ? 0 : myScore) + (isNaN(oppScore) ? 0 : oppScore),
        date: event.date,
      });
    }

    // Sort descending by date (newest finished matches first)
    results.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });

    return results;
  }

  /**
   * Analyze team games against a target line and standard comparison lines
   */
  private analyzeTeamPerformance(
    teamId: string,
    teamName: string,
    venue: 'home' | 'away',
    matches: FinishedMatchRecord[],
    targetLine: number
  ): TeamHistoricalPerformance {
    const totalGamesAnalyzed = matches.length;

    // Hits for target line (e.g. Over 2.5 means 3+ goals)
    const overTargetHits = matches.filter((m) => m.totalGoals > targetLine).length;
    const overTargetMisses = totalGamesAnalyzed - overTargetHits;
    const overTargetRatePercent =
      totalGamesAnalyzed > 0 ? parseFloat(((overTargetHits / totalGamesAnalyzed) * 100).toFixed(1)) : 0;

    // Venue matches (home team at home, away team away)
    const venueMatches = matches.filter((m) => (venue === 'home' ? m.isHome : !m.isHome));
    const venueGamesAnalyzed = venueMatches.length;
    const venueOverHits = venueMatches.filter((m) => m.totalGoals > targetLine).length;
    const venueOverMisses = venueGamesAnalyzed - venueOverHits;
    const venueOverRatePercent =
      venueGamesAnalyzed > 0 ? parseFloat(((venueOverHits / venueGamesAnalyzed) * 100).toFixed(1)) : null;

    // Goal Distribution (0, 1, 2, 3, 4, 5+ goals)
    const goalDistribution: GoalDistribution = {
      goals0: matches.filter((m) => m.totalGoals === 0).length,
      goals1: matches.filter((m) => m.totalGoals === 1).length,
      goals2: matches.filter((m) => m.totalGoals === 2).length,
      goals3: matches.filter((m) => m.totalGoals === 3).length,
      goals4: matches.filter((m) => m.totalGoals === 4).length,
      goals5Plus: matches.filter((m) => m.totalGoals >= 5).length,
    };

    // Alternative lines comparison
    const comparisonLines = [0.5, 1.5, 2.5, 3.5, 4.5];
    const ratesByLine: LineRateItem[] = comparisonLines.map((line) => {
      const hits = matches.filter((m) => m.totalGoals > line).length;
      return {
        line,
        hits,
        total: totalGamesAnalyzed,
        ratePercent:
          totalGamesAnalyzed > 0 ? parseFloat(((hits / totalGamesAnalyzed) * 100).toFixed(1)) : 0,
      };
    });

    // Detailed audit list for user verification (Section 12)
    const auditMatches: TeamAuditMatchItem[] = matches.map((m) => ({
      matchId: m.matchId,
      date: m.date
        ? new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : 'N/D',
      rawDate: m.date,
      isHome: m.isHome,
      opponentName: m.opponentName,
      teamScore: m.teamScore,
      opponentScore: m.opponentScore,
      totalGoals: m.totalGoals,
      isOverTarget: m.totalGoals > targetLine,
    }));

    return {
      teamId,
      teamName,
      totalGamesAnalyzed,
      overTargetHits,
      overTargetMisses,
      overTargetRatePercent,
      venue,
      venueGamesAnalyzed,
      venueOverHits,
      venueOverMisses,
      venueOverRatePercent,
      goalDistribution,
      ratesByLine,
      auditMatches,
    };
  }

  /**
   * Compute complete Historical Probability for a live match scenario
   */
  public async computeHistoricalProbability(
    competitionId: string,
    competitionName: string,
    homeTeam: TeamInfo,
    awayTeam: TeamInfo,
    targetLine: number,
    currentMatchId: string,
    currentMatchDate?: string
  ): Promise<MatchHistoricalProbability> {
    const targetDescription = `Over ${targetLine} (${Math.ceil(targetLine)}+ gols)`;

    // Fetch schedules in parallel
    const [homeSched, awaySched] = await Promise.all([
      this.fetchTeamSchedule(competitionId, homeTeam.id),
      this.fetchTeamSchedule(competitionId, awayTeam.id),
    ]);

    const seasonYear = homeSched?.seasonYear || awaySched?.seasonYear;

    const homeMatches = homeSched
      ? this.filterFinishedMatches(
          homeSched.events,
          homeTeam.id,
          competitionId,
          currentMatchId,
          currentMatchDate,
          seasonYear
        )
      : [];

    const awayMatches = awaySched
      ? this.filterFinishedMatches(
          awaySched.events,
          awayTeam.id,
          competitionId,
          currentMatchId,
          currentMatchDate,
          seasonYear
        )
      : [];

    // Strictly enforce rule: If API does not provide sufficient real history, do NOT invent data
    if (homeMatches.length === 0 && awayMatches.length === 0) {
      return {
        competitionId,
        competitionName,
        seasonYear,
        targetLine,
        targetDescription,
        isAvailable: false,
        statusMessage: 'HISTÓRICO INDISPONÍVEL: Sem partidas anteriores concluídas na mesma competição e temporada.',
        home: null,
        away: null,
        historicalEstimatePercent: null,
        methodologyDescription: 'Histórico indisponível na base de dados oficial para esta competição e temporada.',
        sampleSizeTotalGames: 0,
        isReducedSample: true,
      };
    }

    const homePerf =
      homeMatches.length > 0
        ? this.analyzeTeamPerformance(homeTeam.id, homeTeam.name, 'home', homeMatches, targetLine)
        : null;

    const awayPerf =
      awayMatches.length > 0
        ? this.analyzeTeamPerformance(awayTeam.id, awayTeam.name, 'away', awayMatches, targetLine)
        : null;

    const totalSample = (homeMatches.length || 0) + (awayMatches.length || 0);
    const isReducedSample = totalSample < 8;

    // Combined Historical Scenario Estimate calculation
    let historicalEstimatePercent: number | null = null;
    let methodologyDescription = '';

    if (homePerf && awayPerf) {
      const hasSufficientVenueData =
        homePerf.venueGamesAnalyzed >= 2 &&
        awayPerf.venueGamesAnalyzed >= 2 &&
        homePerf.venueOverRatePercent !== null &&
        awayPerf.venueOverRatePercent !== null;

      if (hasSufficientVenueData) {
        // Weighted composite estimate: 35% home at home + 35% away away + 15% home overall + 15% away overall
        const weightedEstimate =
          homePerf.venueOverRatePercent! * 0.35 +
          awayPerf.venueOverRatePercent! * 0.35 +
          homePerf.overTargetRatePercent * 0.15 +
          awayPerf.overTargetRatePercent * 0.15;

        historicalEstimatePercent = parseFloat(weightedEstimate.toFixed(1));
        methodologyDescription =
          'Ponderação contextual: 35% mandante em casa + 35% visitante fora + 15% mandante geral + 15% visitante geral neste mesmo campeonato e temporada.';
      } else {
        // Fallback: 50% home overall + 50% away overall
        const balancedEstimate =
          homePerf.overTargetRatePercent * 0.5 + awayPerf.overTargetRatePercent * 0.5;

        historicalEstimatePercent = parseFloat(balancedEstimate.toFixed(1));
        methodologyDescription =
          'Média balanceada dos desempenhos gerais das duas equipes nesta competição e temporada (amostra de mando de campo reduzida).';
      }
    } else if (homePerf) {
      historicalEstimatePercent = homePerf.overTargetRatePercent;
      methodologyDescription = `Baseado exclusivamente na frequência histórica do mandante (${homePerf.totalGamesAnalyzed} jogos analisados).`;
    } else if (awayPerf) {
      historicalEstimatePercent = awayPerf.overTargetRatePercent;
      methodologyDescription = `Baseado exclusivamente na frequência histórica do visitante (${awayPerf.totalGamesAnalyzed} jogos analisados).`;
    }

    return {
      competitionId,
      competitionName,
      seasonYear,
      targetLine,
      targetDescription,
      isAvailable: true,
      statusMessage: isReducedSample ? 'Amostra histórica reduzida' : 'Histórico completo analisado',
      home: homePerf,
      away: awayPerf,
      historicalEstimatePercent,
      methodologyDescription,
      sampleSizeTotalGames: totalSample,
      isReducedSample,
    };
  }
}

export const historyService = new HistoryService();
