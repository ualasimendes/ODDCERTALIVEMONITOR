import { CompetitionConfig } from '../models/types.ts';
import { RawCompetitor, RawMatchSummary, RawOddItem, SoccerDataProvider } from './types.ts';

const DEFAULT_COMPETITIONS: CompetitionConfig[] = [
  { id: 'eng.1', name: 'Premier League', slug: 'eng.1', country: 'Inglaterra', isActive: true },
  { id: 'esp.1', name: 'La Liga', slug: 'esp.1', country: 'Espanha', isActive: true },
  { id: 'ita.1', name: 'Serie A', slug: 'ita.1', country: 'Itália', isActive: true },
  { id: 'ger.1', name: 'Bundesliga', slug: 'ger.1', country: 'Alemanha', isActive: true },
  { id: 'fra.1', name: 'Ligue 1', slug: 'fra.1', country: 'França', isActive: true },
  { id: 'bra.1', name: 'Brasileirão Série A', slug: 'bra.1', country: 'Brasil', isActive: true },
  { id: 'uefa.champions', name: 'Champions League', slug: 'uefa.champions', country: 'Europa', isActive: true },
  { id: 'uefa.europa', name: 'Europa League', slug: 'uefa.europa', country: 'Europa', isActive: true },
  { id: 'usa.1', name: 'MLS', slug: 'usa.1', country: 'EUA', isActive: true },
  { id: 'por.1', name: 'Primeira Liga', slug: 'por.1', country: 'Portugal', isActive: true },
  { id: 'ned.1', name: 'Eredivisie', slug: 'ned.1', country: 'Holanda', isActive: true },
  { id: 'arg.1', name: 'Liga Profesional', slug: 'arg.1', country: 'Argentina', isActive: true },
  { id: 'mex.1', name: 'Liga MX', slug: 'mex.1', country: 'México', isActive: true },
  { id: 'eng.2', name: 'Championship', slug: 'eng.2', country: 'Inglaterra', isActive: true },
  { id: 'esp.2', name: 'LaLiga 2', slug: 'esp.2', country: 'Espanha', isActive: true },
];

export class EspnProvider implements SoccerDataProvider {
  public readonly name = 'ESPN Public API';

  public async getCompetitions(): Promise<CompetitionConfig[]> {
    return DEFAULT_COMPETITIONS;
  }

  public async getLiveMatches(competitionIds: string[]): Promise<RawMatchSummary[]> {
    const activeLeagues = competitionIds.length > 0 
      ? competitionIds 
      : DEFAULT_COMPETITIONS.filter(c => c.isActive).map(c => c.id);

    const summaries: RawMatchSummary[] = [];

    // Parallel fetch scoreboards for active leagues
    const scoreboardPromises = activeLeagues.map(async (leagueId) => {
      try {
        const safeLeagueId = encodeURIComponent(leagueId);
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${safeLeagueId}/scoreboard`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return { leagueId, events: [] };
        const data = await res.json();
        const events = data.events || [];
        
        // Find in-progress matches, or scheduled/recent if none live
        const liveEvents = events.filter((e: any) => e.status?.type?.state === 'in');
        return { leagueId, events: liveEvents.length > 0 ? liveEvents : events.slice(0, 2) };
      } catch (e) {
        return { leagueId, events: [] };
      }
    });

    const scoreboardResults = await Promise.all(scoreboardPromises);

    // For every match found (especially live 'in' matches), fetch summary for detailed stats, xG and odds
    const detailPromises: Promise<RawMatchSummary | null>[] = [];

    for (const res of scoreboardResults) {
      for (const ev of res.events) {
        // Prioritize in-game matches
        detailPromises.push(this.getMatchDetail(ev.id, res.leagueId, ev));
      }
    }

    const matchDetails = await Promise.all(detailPromises);
    for (const m of matchDetails) {
      if (m) summaries.push(m);
    }

    return summaries;
  }

  public async getMatchDetail(matchId: string, leagueId: string, eventBrief?: any): Promise<RawMatchSummary | null> {
    try {
      const safeLeagueId = encodeURIComponent(leagueId);
      const safeMatchId = encodeURIComponent(matchId);
      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${safeLeagueId}/summary?event=${safeMatchId}`;
      const res = await fetch(summaryUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const data = await res.json();

      const header = data.header?.competitions?.[0];
      const eventStatus = header?.status || eventBrief?.status;
      const state = eventStatus?.type?.state || 'in';
      const clockStr = eventStatus?.displayClock || `${Math.round(eventStatus?.clock || 0)}'`;
      let parsedMinute = 0;
      if (typeof eventStatus?.clock === 'number' && eventStatus.clock > 0) {
        parsedMinute = Math.round(eventStatus.clock > 120 ? eventStatus.clock / 60 : eventStatus.clock);
      } else if (clockStr) {
        const parts = clockStr.split('+');
        const base = parseInt(parts[0].replace(/[^0-9]/g, ''), 10) || 0;
        const extra = parts[1] ? (parseInt(parts[1].replace(/[^0-9]/g, ''), 10) || 0) : 0;
        parsedMinute = base + extra;
      }
      const minute = parsedMinute;
      const statusDetail = eventStatus?.type?.shortDetail || eventStatus?.type?.detail || `${minute}'`;

      const compLeague = DEFAULT_COMPETITIONS.find(c => c.id === leagueId);
      const competitionName = compLeague?.name || data.header?.league?.name || leagueId;

      // Teams and competitors
      const competitors = header?.competitors || eventBrief?.competitions?.[0]?.competitors || [];
      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

      if (!homeComp || !awayComp) return null;

      const homeTeam: RawCompetitor = {
        id: homeComp.team?.id || 'home',
        name: homeComp.team?.displayName || 'Casa',
        shortName: homeComp.team?.shortDisplayName || homeComp.team?.name || 'Casa',
        abbreviation: homeComp.team?.abbreviation || 'CASA',
        score: parseInt(homeComp.score || '0', 10),
        homeAway: 'home',
        logoUrl: homeComp.team?.logos?.[0]?.href,
      };

      const awayTeam: RawCompetitor = {
        id: awayComp.team?.id || 'away',
        name: awayComp.team?.displayName || 'Fora',
        shortName: awayComp.team?.shortDisplayName || awayComp.team?.name || 'Fora',
        abbreviation: awayComp.team?.abbreviation || 'FORA',
        score: parseInt(awayComp.score || '0', 10),
        homeAway: 'away',
        logoUrl: awayComp.team?.logos?.[0]?.href,
      };

      // Extract boxscore stats
      const boxscoreStats: { home: { [key: string]: number }; away: { [key: string]: number } } = {
        home: {},
        away: {},
      };

      if (data.boxscore?.teams) {
        for (const t of data.boxscore.teams) {
          const isHome = t.homeAway === 'home' || t.team?.id === homeTeam.id;
          const targetObj = isHome ? boxscoreStats.home : boxscoreStats.away;
          if (t.statistics) {
            for (const s of t.statistics) {
              const val = parseFloat(s.displayValue || `${s.value}`) || 0;
              targetObj[s.name] = val;
            }
          }
        }
      }

      // Extract xG from summary.leaders
      let homeXg: number | null = null;
      let awayXg: number | null = null;

      if (data.leaders && Array.isArray(data.leaders)) {
        for (const l of data.leaders) {
          const teamId = l.team?.id;
          const isHomeTeam = teamId === homeTeam.id || l.team?.displayName === homeTeam.name;

          l.leaders?.forEach((cat: any) => {
            cat.leaders?.forEach((ath: any) => {
              ath.statistics?.forEach((st: any) => {
                const val = parseFloat(st.value);
                if (!isNaN(val)) {
                  // In ESPN soccer:
                  // goalkeeper's expectedGoalsConceded (xGC) = opposing team's xG
                  if (st.name === 'expectedGoalsConceded') {
                    if (isHomeTeam) {
                      // Home goalkeeper xGC is Away team xG
                      if (awayXg === null || val > awayXg) awayXg = val;
                    } else {
                      // Away goalkeeper xGC is Home team xG
                      if (homeXg === null || val > homeXg) homeXg = val;
                    }
                  }
                }
              });
            });
          });
        }
      }

      // If xGC was not available, look at commentary-derived shots or athlete xG
      const commentaryPlays: Array<{
        timeDisplay: string;
        minute: number;
        text: string;
        type?: string;
      }> = [];

      if (data.commentary && Array.isArray(data.commentary)) {
        for (const c of data.commentary) {
          const timeStr = c.time?.displayValue || '';
          const matchMin = parseInt(timeStr.replace(/[^0-9]/g, ''), 10) || 0;
          if (c.text) {
            commentaryPlays.push({
              timeDisplay: timeStr,
              minute: matchMin,
              text: c.text,
              type: c.type?.text,
            });
          }
        }
      }

      // Extract real Match Events (Goals, Cards, Substitutions, Penalties, VAR)
      const events: import('../models/types.ts').MatchEventItem[] = [];
      const seenEventIds = new Set<string>();

      if (data.keyEvents && Array.isArray(data.keyEvents)) {
        for (const ke of data.keyEvents) {
          const typeStr = (ke.type?.type || ke.type?.text || '').toLowerCase();
          const clockDisplay = ke.clock?.displayValue || (ke.clock?.value ? `${Math.round(ke.clock.value / 60)}'` : '');
          const minuteNum = parseInt(clockDisplay.replace(/[^0-9]/g, ''), 10) || (ke.clock?.value ? Math.round(ke.clock.value / 60) : 0);

          let eventType: import('../models/types.ts').MatchEventItem['type'] = 'other';
          if (typeStr.includes('goal') || ke.scoringPlay) {
            eventType = 'goal';
          } else if (typeStr.includes('red') || ke.redCard) {
            eventType = 'red-card';
          } else if (typeStr.includes('yellow') || typeStr.includes('card')) {
            eventType = 'yellow-card';
          } else if (typeStr.includes('sub') || typeStr.includes('substitution')) {
            eventType = 'substitution';
          } else if (typeStr.includes('pen') || ke.penaltyKick) {
            eventType = 'penalty';
          } else if (typeStr.includes('var')) {
            eventType = 'var';
          }

          if (['goal', 'yellow-card', 'red-card', 'substitution', 'penalty', 'var'].includes(eventType)) {
            const teamId = ke.team?.id;
            const isHome = teamId ? (teamId === homeTeam.id) : undefined;
            const eventId = ke.id || `${minuteNum}-${eventType}-${events.length}`;

            if (!seenEventIds.has(eventId)) {
              seenEventIds.add(eventId);
              events.push({
                id: eventId,
                minute: minuteNum,
                timeDisplay: clockDisplay || `${minuteNum}'`,
                type: eventType,
                text: ke.text || ke.shortText || typeStr,
                shortText: ke.shortText,
                teamId,
                teamName: ke.team?.displayName || (isHome ? homeTeam.name : awayTeam.name),
                isHome,
              });
            }
          }
        }
      }

      // If keyEvents was empty, check header details for scoring plays
      if (events.length === 0 && header?.details && Array.isArray(header.details)) {
        for (const det of header.details) {
          const minuteNum = parseInt((det.clock?.displayValue || '').replace(/[^0-9]/g, ''), 10) || 0;
          const isHome = det.team?.id === homeTeam.id;
          const eventType: import('../models/types.ts').MatchEventItem['type'] = det.scoringPlay ? 'goal' : det.redCard ? 'red-card' : det.penaltyKick ? 'penalty' : 'yellow-card';
          const eventId = `det-${det.clock?.value || minuteNum}-${events.length}`;

          events.push({
            id: eventId,
            minute: minuteNum,
            timeDisplay: det.clock?.displayValue || `${minuteNum}'`,
            type: eventType,
            text: det.participants?.[0]?.athlete?.displayName ? `${det.participants[0].athlete.displayName} (${det.scoringPlay ? 'Gol' : 'Lance'})` : (det.scoringPlay ? 'Gol' : 'Cartão'),
            shortText: det.scoringPlay ? 'Gol' : 'Lance',
            teamId: det.team?.id,
            teamName: det.team?.displayName,
            isHome,
          });
        }
      }

      events.sort((a, b) => b.minute - a.minute);

      // Odds extraction (from data.odds, data.pickcenter, data.header, and eventBrief)
      const oddsList: RawOddItem[] = [];
      const rawOdds = [
        ...(Array.isArray(data.odds) ? data.odds : []),
        ...(Array.isArray(data.pickcenter) ? data.pickcenter : []),
        ...(Array.isArray(data.header?.competitions?.[0]?.odds) ? data.header.competitions[0].odds : []),
        ...(Array.isArray(eventBrief?.competitions?.[0]?.odds) ? eventBrief.competitions[0].odds : []),
      ];

      const seenOddKeys = new Set<string>();

      if (Array.isArray(rawOdds)) {
        for (const o of rawOdds) {
          if (!o || typeof o !== 'object') continue;
          const providerName = o.provider?.name || 'DraftKings';
          const isLive = providerName.toLowerCase().includes('live');

          // 1. Check current object (often has decimal directly: o.current.over.decimal or value)
          if (o.current?.over) {
            const curLine = parseFloat(o.current.total?.alternateDisplayValue || o.current.total?.american || o.overUnder);
            const curDec = typeof o.current.over.decimal === 'number'
              ? o.current.over.decimal
              : typeof o.current.over.value === 'number'
              ? o.current.over.value
              : this.americanToDecimal(o.current.over.american || o.current.over.odds);
            if (!isNaN(curLine) && curDec !== null && curDec > 1.01) {
              const key = `${providerName}:${curLine}:${curDec.toFixed(2)}`;
              if (!seenOddKeys.has(key)) {
                seenOddKeys.add(key);
                oddsList.push({
                  providerName: isLive ? providerName : `${providerName} (Ao Vivo)`,
                  market: 'over_under',
                  line: curLine,
                  overOddsDecimal: parseFloat(curDec.toFixed(2)),
                  underOddsDecimal: null,
                  isLive: true,
                });
              }
            }
          }

          // 2. Check total.over.current
          if (o.total?.over?.current) {
            const liveLine = parseFloat(String(o.total.over.current.line || '').replace(/[^0-9.]/g, ''));
            const liveDec = this.americanToDecimal(o.total.over.current.odds);
            if (!isNaN(liveLine) && liveDec !== null && liveDec > 1.01) {
              const key = `${providerName}:${liveLine}:${liveDec.toFixed(2)}`;
              if (!seenOddKeys.has(key)) {
                seenOddKeys.add(key);
                oddsList.push({
                  providerName: `${providerName} (Ao Vivo)`,
                  market: 'over_under',
                  line: liveLine,
                  overOddsDecimal: liveDec,
                  underOddsDecimal: null,
                  isLive: true,
                });
              }
            }
          }

          // 3. Check total.over.close
          if (o.total?.over?.close) {
            const closeLine = parseFloat(String(o.total.over.close.line || '').replace(/[^0-9.]/g, ''));
            const closeDec = this.americanToDecimal(o.total.over.close.odds);
            if (!isNaN(closeLine) && closeDec !== null && closeDec > 1.01) {
              const key = `${providerName}:${closeLine}:${closeDec.toFixed(2)}`;
              if (!seenOddKeys.has(key)) {
                seenOddKeys.add(key);
                oddsList.push({
                  providerName,
                  market: 'over_under',
                  line: closeLine,
                  overOddsDecimal: closeDec,
                  underOddsDecimal: null,
                  isLive,
                });
              }
            }
          }

          // 4. Standard overUnder & overOdds
          const line = typeof o.overUnder === 'number' ? o.overUnder : parseFloat(o.overUnder);
          if (!isNaN(line)) {
            const overOddsDecimal = this.americanToDecimal(o.overOdds);
            const underOddsDecimal = this.americanToDecimal(o.underOdds);

            if (overOddsDecimal !== null && overOddsDecimal > 1.01) {
              const key = `${providerName}:${line}:${overOddsDecimal.toFixed(2)}`;
              if (!seenOddKeys.has(key)) {
                seenOddKeys.add(key);
                oddsList.push({
                  providerName,
                  market: 'over_under',
                  line,
                  overOddsDecimal,
                  underOddsDecimal,
                  isLive,
                });
              }
            }
          }
        }
      }

      const totalXg = homeXg !== null || awayXg !== null 
        ? parseFloat(((homeXg || 0) + (awayXg || 0)).toFixed(2)) 
        : null;

      return {
        id: matchId,
        competitionId: leagueId,
        competitionName,
        homeTeam,
        awayTeam,
        minute,
        displayClock: clockStr,
        state: state === 'in' ? 'in' : state === 'post' ? 'post' : 'pre',
        statusDetail,
        homeXg,
        awayXg,
        totalXg,
        boxscoreStats,
        commentaryPlays,
        events,
        oddsList,
      };
    } catch (err) {
      console.error(`[EspnProvider] Error fetching match ${matchId}:`, err);
      return null;
    }
  }

  private americanToDecimal(american: any): number | null {
    if (american === undefined || american === null) return null;
    const num = typeof american === 'number' ? american : parseFloat(String(american).replace('+', ''));
    if (isNaN(num)) return null;

    if (num > 0) {
      return parseFloat((1 + num / 100).toFixed(2));
    } else if (num < 0) {
      return parseFloat((1 + 100 / Math.abs(num)).toFixed(2));
    }
    return 1.0;
  }
}
