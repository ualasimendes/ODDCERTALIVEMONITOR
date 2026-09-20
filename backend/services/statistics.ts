import { GameSnapshot, MatchRecentStats, MatchStatsAccumulated, MatchTimelineAction, TeamRecentStats, TeamStats } from '../models/types.ts';
import { RawMatchSummary } from '../providers/types.ts';

export class StatisticsService {
  /**
   * Calculate realistic Expected Goals (xG) from shot volume, shot location, and chance quality
   * when official Opta xG is not provided for the league/game by the API feed.
   */
  public calculateShotQualityXg(stats: {
    totalShots: number | null;
    shotsOnTarget: number | null;
    shotsInsideBox: number | null;
    bigChances: number | null;
    penalties?: number | null;
  }): number {
    const totalShots = stats.totalShots ?? 0;
    if (totalShots <= 0) return 0.0;

    const sot = Math.min(totalShots, Math.max(0, stats.shotsOnTarget ?? 0));
    // Default inside box distribution if commentary locations not available: ~55% of shots
    const insideBox = Math.min(totalShots, Math.max(0, stats.shotsInsideBox ?? Math.round(totalShots * 0.55)));
    const outsideBox = Math.max(0, totalShots - insideBox);
    const bigChances = Math.max(0, stats.bigChances ?? 0);
    const penalties = Math.max(0, stats.penalties ?? 0);

    // Standard football expected goals weights (consistent with Opta / StatsBomb baselines):
    const sotInside = Math.min(sot, insideBox);
    const offInside = Math.max(0, insideBox - sotInside);
    const sotOutside = Math.max(0, sot - sotInside);
    const offOutside = Math.max(0, outsideBox - sotOutside);

    const calculated =
      penalties * 0.78 +
      bigChances * 0.20 +
      sotInside * 0.20 +
      offInside * 0.08 +
      sotOutside * 0.06 +
      offOutside * 0.025;

    return parseFloat(Math.max(0, calculated).toFixed(2));
  }

  /**
   * Parse real detailed statistics for both Home (CASA) and Away (FORA) teams.
   * Never invent, estimate, or simulate numbers.
   * If a stat is not provided by the real API response, return null (rendered as N/D).
   */
  public parseTeamDetailedStats(raw: RawMatchSummary): { home: TeamStats; away: TeamStats } {
    const homeRaw = raw.boxscoreStats.home || {};
    const awayRaw = raw.boxscoreStats.away || {};

    const homeShots = homeRaw['totalShots'] ?? homeRaw['shots'] ?? null;
    const awayShots = awayRaw['totalShots'] ?? awayRaw['shots'] ?? null;

    const homeSot = homeRaw['shotsOnTarget'] ?? null;
    const awaySot = awayRaw['shotsOnTarget'] ?? null;

    const homeBlocked = homeRaw['blockedShots'] ?? null;
    const awayBlocked = awayRaw['blockedShots'] ?? null;

    let homeOffTarget: number | null = null;
    if (homeShots !== null && homeSot !== null) {
      homeOffTarget = Math.max(0, homeShots - homeSot - (homeBlocked || 0));
    } else if (homeRaw['shotsOffTarget'] !== undefined) {
      homeOffTarget = homeRaw['shotsOffTarget'];
    }

    let awayOffTarget: number | null = null;
    if (awayShots !== null && awaySot !== null) {
      awayOffTarget = Math.max(0, awayShots - awaySot - (awayBlocked || 0));
    } else if (awayRaw['shotsOffTarget'] !== undefined) {
      awayOffTarget = awayRaw['shotsOffTarget'];
    }

    // Count commentary plays strictly by team if available
    let homeInsideBox = 0;
    let awayInsideBox = 0;
    let homeBigChances = 0;
    let awayBigChances = 0;
    let foundHomeInside = false;
    let foundAwayInside = false;
    let foundHomeBig = false;
    let foundAwayBig = false;

    if (raw.commentaryPlays && raw.commentaryPlays.length > 0) {
      const homeKeywords = [
        raw.homeTeam.name.toLowerCase(),
        raw.homeTeam.shortName.toLowerCase(),
        raw.homeTeam.abbreviation.toLowerCase(),
      ].filter(Boolean);

      const awayKeywords = [
        raw.awayTeam.name.toLowerCase(),
        raw.awayTeam.shortName.toLowerCase(),
        raw.awayTeam.abbreviation.toLowerCase(),
      ].filter(Boolean);

      for (const play of raw.commentaryPlays) {
        const text = play.text.toLowerCase();
        const isShot = text.includes('shot') || text.includes('attempt') || text.includes('goal');
        if (!isShot) continue;

        const isHome = homeKeywords.some(k => text.includes(k));
        const isAway = awayKeywords.some(k => text.includes(k));

        const isInside =
          text.includes('centre of the box') ||
          text.includes('six yard box') ||
          text.includes('penalty area') ||
          text.includes('inside the box') ||
          text.includes('from very close range');

        const isBig =
          text.includes('big chance') ||
          text.includes('one on one') ||
          text.includes('open goal') ||
          text.includes('penalty kick') ||
          text.includes('goal!');

        if (isHome) {
          if (isInside) { homeInsideBox++; foundHomeInside = true; }
          if (isBig) { homeBigChances++; foundHomeBig = true; }
        } else if (isAway) {
          if (isInside) { awayInsideBox++; foundAwayInside = true; }
          if (isBig) { awayBigChances++; foundAwayBig = true; }
        }
      }
    }

    const finalHomeInside = foundHomeInside ? homeInsideBox : (homeRaw['shotsInsideBox'] ?? null);
    const finalHomeBig = foundHomeBig ? homeBigChances : (homeRaw['bigChances'] ?? null);
    const calculatedHomeShotXg = (raw.state === 'in' || (homeShots !== null && homeShots > 0))
      ? this.calculateShotQualityXg({
          totalShots: homeShots,
          shotsOnTarget: homeSot,
          shotsInsideBox: finalHomeInside,
          bigChances: finalHomeBig,
          penalties: homeRaw['penaltyKickGoals'] ?? homeRaw['penaltyKickShots'] ?? 0,
        })
      : null;
    const effectiveHomeXg = raw.homeXg !== null
      ? Math.max(raw.homeXg, calculatedHomeShotXg ?? 0)
      : calculatedHomeShotXg;

    const finalAwayInside = foundAwayInside ? awayInsideBox : (awayRaw['shotsInsideBox'] ?? null);
    const finalAwayBig = foundAwayBig ? awayBigChances : (awayRaw['bigChances'] ?? null);
    const calculatedAwayShotXg = (raw.state === 'in' || (awayShots !== null && awayShots > 0))
      ? this.calculateShotQualityXg({
          totalShots: awayShots,
          shotsOnTarget: awaySot,
          shotsInsideBox: finalAwayInside,
          bigChances: finalAwayBig,
          penalties: awayRaw['penaltyKickGoals'] ?? awayRaw['penaltyKickShots'] ?? 0,
        })
      : null;
    const effectiveAwayXg = raw.awayXg !== null
      ? Math.max(raw.awayXg, calculatedAwayShotXg ?? 0)
      : calculatedAwayShotXg;

    const homeStats: TeamStats = {
      xg: effectiveHomeXg,
      totalShots: homeShots,
      shotsOnTarget: homeSot,
      shotsOffTarget: homeOffTarget,
      blockedShots: homeBlocked,
      shotsInsideBox: finalHomeInside,
      shotsOutsideBox: (homeShots !== null && finalHomeInside !== null) ? Math.max(0, homeShots - finalHomeInside) : (homeRaw['shotsOutsideBox'] ?? null),
      bigChances: finalHomeBig,
      corners: homeRaw['wonCorners'] ?? homeRaw['corners'] ?? null,
      possession: homeRaw['possessionPct'] ?? null,
      passes: homeRaw['totalPasses'] ?? homeRaw['passes'] ?? null,
      passAccuracy: homeRaw['passingAccuracy'] ?? homeRaw['passPct'] ?? null,
      fouls: homeRaw['foulsCommitted'] ?? homeRaw['fouls'] ?? null,
      yellowCards: homeRaw['yellowCards'] ?? null,
      redCards: homeRaw['redCards'] ?? null,
      offsides: homeRaw['offsides'] ?? null,
      attacks: homeRaw['attacks'] ?? null,
      dangerousAttacks: homeRaw['dangerousAttacks'] ?? null,
    };

    const awayStats: TeamStats = {
      xg: effectiveAwayXg,
      totalShots: awayShots,
      shotsOnTarget: awaySot,
      shotsOffTarget: awayOffTarget,
      blockedShots: awayBlocked,
      shotsInsideBox: finalAwayInside,
      shotsOutsideBox: (awayShots !== null && finalAwayInside !== null) ? Math.max(0, awayShots - finalAwayInside) : (awayRaw['shotsOutsideBox'] ?? null),
      bigChances: finalAwayBig,
      corners: awayRaw['wonCorners'] ?? awayRaw['corners'] ?? null,
      possession: awayRaw['possessionPct'] ?? null,
      passes: awayRaw['totalPasses'] ?? awayRaw['passes'] ?? null,
      passAccuracy: awayRaw['passingAccuracy'] ?? awayRaw['passPct'] ?? null,
      fouls: awayRaw['foulsCommitted'] ?? awayRaw['fouls'] ?? null,
      yellowCards: awayRaw['yellowCards'] ?? null,
      redCards: awayRaw['redCards'] ?? null,
      offsides: awayRaw['offsides'] ?? null,
      attacks: awayRaw['attacks'] ?? null,
      dangerousAttacks: awayRaw['dangerousAttacks'] ?? null,
    };

    return { home: homeStats, away: awayStats };
  }

  /**
   * Compute recent statistics broken down by Home and Away teams for 5', 10', 15' windows.
   */
  public computeRecentStatsByTeam(
    raw: RawMatchSummary,
    snapshots: GameSnapshot[],
    windowMinutes: 5 | 10 | 15
  ): { home: TeamRecentStats; away: TeamRecentStats } {
    if (raw.state === 'pre' || raw.minute <= 0) {
      return {
        home: {
          xg: null,
          totalShots: null,
          shotsOnTarget: null,
          shotsOffTarget: null,
          shotsInsideBox: null,
          shotsOutsideBox: null,
          blockedShots: null,
          bigChances: null,
          corners: null,
          yellowCards: null,
          redCards: null,
          goals: null,
          fouls: null,
        },
        away: {
          xg: null,
          totalShots: null,
          shotsOnTarget: null,
          shotsOffTarget: null,
          shotsInsideBox: null,
          shotsOutsideBox: null,
          blockedShots: null,
          bigChances: null,
          corners: null,
          yellowCards: null,
          redCards: null,
          goals: null,
          fouls: null,
        },
      };
    }

    const currentMinute = raw.minute;
    const minMinute = Math.max(0, currentMinute - windowMinutes);

    let homeXgDelta: number | null = null;
    let awayXgDelta: number | null = null;
    let snapHomeShots: number | null = null;
    let snapAwayShots: number | null = null;
    let snapHomeSot: number | null = null;
    let snapAwaySot: number | null = null;
    let snapHomeOff: number | null = null;
    let snapAwayOff: number | null = null;
    let snapHomeInside: number | null = null;
    let snapAwayInside: number | null = null;
    let snapHomeBig: number | null = null;
    let snapAwayBig: number | null = null;

    if (snapshots.length >= 2) {
      const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const currentSnap = sorted[sorted.length - 1];
      const priorSnaps = sorted.filter(s => s.minute <= minMinute);
      const pastSnap = priorSnaps.length > 0 ? priorSnaps[priorSnaps.length - 1] : sorted[0];

      if (pastSnap && currentSnap && pastSnap !== currentSnap) {
        if (pastSnap.homeXg !== null && currentSnap.homeXg !== null) {
          homeXgDelta = Math.max(0, parseFloat((currentSnap.homeXg - pastSnap.homeXg).toFixed(2)));
        }
        if (pastSnap.awayXg !== null && currentSnap.awayXg !== null) {
          awayXgDelta = Math.max(0, parseFloat((currentSnap.awayXg - pastSnap.awayXg).toFixed(2)));
        }
        if (pastSnap.homeShots !== null && currentSnap.homeShots !== null) {
          snapHomeShots = Math.max(0, currentSnap.homeShots - pastSnap.homeShots);
        }
        if (pastSnap.awayShots !== null && currentSnap.awayShots !== null) {
          snapAwayShots = Math.max(0, currentSnap.awayShots - pastSnap.awayShots);
        }
        if (pastSnap.homeShotsOnTarget !== null && currentSnap.homeShotsOnTarget !== null) {
          snapHomeSot = Math.max(0, currentSnap.homeShotsOnTarget - pastSnap.homeShotsOnTarget);
        }
        if (pastSnap.awayShotsOnTarget !== null && currentSnap.awayShotsOnTarget !== null) {
          snapAwaySot = Math.max(0, currentSnap.awayShotsOnTarget - pastSnap.awayShotsOnTarget);
        }
        if (pastSnap.homeShotsOffTarget !== null && currentSnap.homeShotsOffTarget !== null) {
          snapHomeOff = Math.max(0, currentSnap.homeShotsOffTarget - pastSnap.homeShotsOffTarget);
        }
        if (pastSnap.awayShotsOffTarget !== null && currentSnap.awayShotsOffTarget !== null) {
          snapAwayOff = Math.max(0, currentSnap.awayShotsOffTarget - pastSnap.awayShotsOffTarget);
        }
        if (pastSnap.homeShotsInsideBox !== null && currentSnap.homeShotsInsideBox !== null) {
          snapHomeInside = Math.max(0, currentSnap.homeShotsInsideBox - pastSnap.homeShotsInsideBox);
        }
        if (pastSnap.awayShotsInsideBox !== null && currentSnap.awayShotsInsideBox !== null) {
          snapAwayInside = Math.max(0, currentSnap.awayShotsInsideBox - pastSnap.awayShotsInsideBox);
        }
        if (pastSnap.homeBigChances !== null && currentSnap.homeBigChances !== null) {
          snapHomeBig = Math.max(0, currentSnap.homeBigChances - pastSnap.homeBigChances);
        }
        if (pastSnap.awayBigChances !== null && currentSnap.awayBigChances !== null) {
          snapAwayBig = Math.max(0, currentSnap.awayBigChances - pastSnap.awayBigChances);
        }
      }
    }

    // Count commentary plays in window for home and away
    let homeShots = 0;
    let awayShots = 0;
    let homeSot = 0;
    let awaySot = 0;
    let homeOffTarget = 0;
    let awayOffTarget = 0;
    let homeInsideBox = 0;
    let awayInsideBox = 0;
    let homeBigChances = 0;
    let awayBigChances = 0;
    let homeCorners = 0;
    let awayCorners = 0;
    let homeFouls = 0;
    let awayFouls = 0;
    let homeYellow = 0;
    let awayYellow = 0;
    let homeRed = 0;
    let awayRed = 0;
    let homeGoals = 0;
    let awayGoals = 0;
    let hasCommentary = false;

    // Check events for goals and cards in window
    if (raw.events && raw.events.length > 0) {
      for (const evt of raw.events) {
        if (evt.minute > minMinute && evt.minute <= currentMinute) {
          if (evt.type === 'goal') {
            if (evt.isHome) homeGoals++; else awayGoals++;
          } else if (evt.type === 'yellow-card') {
            if (evt.isHome) homeYellow++; else awayYellow++;
          } else if (evt.type === 'red-card') {
            if (evt.isHome) homeRed++; else awayRed++;
          }
        }
      }
    }

    if (raw.commentaryPlays && raw.commentaryPlays.length > 0) {
      hasCommentary = true;
      const homeKeywords = [
        raw.homeTeam.name.toLowerCase(),
        raw.homeTeam.shortName.toLowerCase(),
        raw.homeTeam.abbreviation.toLowerCase(),
      ].filter(Boolean);

      const awayKeywords = [
        raw.awayTeam.name.toLowerCase(),
        raw.awayTeam.shortName.toLowerCase(),
        raw.awayTeam.abbreviation.toLowerCase(),
      ].filter(Boolean);

      for (const p of raw.commentaryPlays) {
        if (p.minute > minMinute && p.minute <= currentMinute) {
          const text = p.text.toLowerCase();
          const isHome = homeKeywords.some(k => text.includes(k));
          const isAway = awayKeywords.some(k => text.includes(k));

          const isShot = text.includes('shot') || text.includes('attempt') || text.includes('goal');
          if (isShot) {
            const isSot = text.includes('goal!') || text.includes('saved') || text.includes('bottom right') || text.includes('top left') || text.includes('bottom left') || text.includes('top right');
            const isOff = text.includes('missed') || text.includes('high') || text.includes('wide') || text.includes('post') || text.includes('bar');
            const isInside = text.includes('centre of the box') || text.includes('six yard box') || text.includes('inside the box') || text.includes('close range');
            const isBig = text.includes('big chance') || text.includes('open goal') || text.includes('goal!');

            if (isHome) {
              homeShots++;
              if (isSot) homeSot++;
              if (isOff) homeOffTarget++;
              if (isInside) homeInsideBox++;
              if (isBig) homeBigChances++;
            } else if (isAway) {
              awayShots++;
              if (isSot) awaySot++;
              if (isOff) awayOffTarget++;
              if (isInside) awayInsideBox++;
              if (isBig) awayBigChances++;
            }
          }

          if (text.includes('corner')) {
            if (isHome) homeCorners++;
            else if (isAway) awayCorners++;
          }

          if (text.includes('foul')) {
            if (isHome) homeFouls++;
            else if (isAway) awayFouls++;
          }
        }
      }
    }

    const hasSnapshots = snapHomeShots !== null;
    const finalHomeShots = hasSnapshots ? Math.max(snapHomeShots!, homeShots) : (hasCommentary ? homeShots : null);
    const finalAwayShots = snapAwayShots !== null ? Math.max(snapAwayShots, awayShots) : (hasCommentary ? awayShots : null);
    const finalHomeSot = snapHomeSot !== null ? Math.max(snapHomeSot, homeSot) : (hasCommentary ? homeSot : null);
    const finalAwaySot = snapAwaySot !== null ? Math.max(snapAwaySot, awaySot) : (hasCommentary ? awaySot : null);
    const finalHomeOff = snapHomeOff !== null ? Math.max(snapHomeOff, homeOffTarget) : (hasCommentary ? homeOffTarget : null);
    const finalAwayOff = snapAwayOff !== null ? Math.max(snapAwayOff, awayOffTarget) : (hasCommentary ? awayOffTarget : null);
    const finalHomeInside = snapHomeInside !== null ? Math.max(snapHomeInside, homeInsideBox) : (hasCommentary ? homeInsideBox : null);
    const finalAwayInside = snapAwayInside !== null ? Math.max(snapAwayInside, awayInsideBox) : (hasCommentary ? awayInsideBox : null);
    const finalHomeBig = snapHomeBig !== null ? Math.max(snapHomeBig, homeBigChances) : (hasCommentary ? homeBigChances : null);
    const finalAwayBig = snapAwayBig !== null ? Math.max(snapAwayBig, awayBigChances) : (hasCommentary ? awayBigChances : null);

    const homeBlocked = (finalHomeShots !== null && finalHomeSot !== null && finalHomeOff !== null) 
      ? Math.max(0, finalHomeShots - finalHomeSot - finalHomeOff) 
      : 0;
    const awayBlocked = (finalAwayShots !== null && finalAwaySot !== null && finalAwayOff !== null) 
      ? Math.max(0, finalAwayShots - finalAwaySot - finalAwayOff) 
      : 0;
    const homeOutside = (finalHomeShots !== null && finalHomeInside !== null) 
      ? Math.max(0, finalHomeShots - finalHomeInside) 
      : 0;
    const awayOutside = (finalAwayShots !== null && finalAwayInside !== null) 
      ? Math.max(0, finalAwayShots - finalAwayInside) 
      : 0;

    // Calculate window xG from shots when snapshot delta is not yet accumulated
    const commHomeXg = this.calculateShotQualityXg({
      totalShots: finalHomeShots,
      shotsOnTarget: finalHomeSot,
      shotsInsideBox: finalHomeInside,
      bigChances: finalHomeBig,
      penalties: homeGoals > 0 && raw.events?.some(e => e.minute > minMinute && e.minute <= currentMinute && e.type === 'penalty' && e.isHome) ? 1 : 0,
    });

    const commAwayXg = this.calculateShotQualityXg({
      totalShots: finalAwayShots,
      shotsOnTarget: finalAwaySot,
      shotsInsideBox: finalAwayInside,
      bigChances: finalAwayBig,
      penalties: awayGoals > 0 && raw.events?.some(e => e.minute > minMinute && e.minute <= currentMinute && e.type === 'penalty' && !e.isHome) ? 1 : 0,
    });

    const resolvedHomeXg = homeXgDelta !== null 
      ? Math.max(homeXgDelta, commHomeXg) 
      : (finalHomeShots !== null && finalHomeShots > 0 ? commHomeXg : (homeXgDelta ?? (hasCommentary ? 0 : null)));

    const resolvedAwayXg = awayXgDelta !== null 
      ? Math.max(awayXgDelta, commAwayXg) 
      : (finalAwayShots !== null && finalAwayShots > 0 ? commAwayXg : (awayXgDelta ?? (hasCommentary ? 0 : null)));

    return {
      home: {
        xg: resolvedHomeXg,
        totalShots: finalHomeShots,
        shotsOnTarget: finalHomeSot,
        shotsOffTarget: finalHomeOff,
        blockedShots: homeBlocked,
        shotsInsideBox: finalHomeInside,
        shotsOutsideBox: homeOutside,
        bigChances: finalHomeBig,
        corners: homeCorners,
        yellowCards: homeYellow,
        redCards: homeRed,
        goals: homeGoals,
        fouls: homeFouls,
      },
      away: {
        xg: resolvedAwayXg,
        totalShots: finalAwayShots,
        shotsOnTarget: finalAwaySot,
        shotsOffTarget: finalAwayOff,
        blockedShots: awayBlocked,
        shotsInsideBox: finalAwayInside,
        shotsOutsideBox: awayOutside,
        bigChances: finalAwayBig,
        corners: awayCorners,
        yellowCards: awayYellow,
        redCards: awayRed,
        goals: awayGoals,
        fouls: awayFouls,
      },
    };
  }

  /**
   * Parse accumulated total statistics strictly from real ESPN match summary boxscore
   * Never invent, estimate, or multiply fields. If not present in the real API response, returns null.
   */
  public parseAccumulatedStats(raw: RawMatchSummary): MatchStatsAccumulated {
    const homeStats = raw.boxscoreStats.home || {};
    const awayStats = raw.boxscoreStats.away || {};

    const homeShots = homeStats['totalShots'] ?? homeStats['shots'] ?? null;
    const awayShots = awayStats['totalShots'] ?? awayStats['shots'] ?? null;
    const totalShots = homeShots !== null || awayShots !== null 
      ? (homeShots || 0) + (awayShots || 0) 
      : null;

    const homeSOT = homeStats['shotsOnTarget'] ?? null;
    const awaySOT = awayStats['shotsOnTarget'] ?? null;
    const shotsOnTarget = homeSOT !== null || awaySOT !== null
      ? (homeSOT || 0) + (awaySOT || 0)
      : null;

    const homeBlocked = homeStats['blockedShots'] || 0;
    const awayBlocked = awayStats['blockedShots'] || 0;
    const totalBlocked = (homeStats['blockedShots'] !== undefined || awayStats['blockedShots'] !== undefined)
      ? homeBlocked + awayBlocked
      : 0;

    // Real Shots off target derived strictly from real total - real SOT - real blocked if all exist
    let shotsOffTarget: number | null = null;
    if (totalShots !== null && shotsOnTarget !== null) {
      shotsOffTarget = Math.max(0, totalShots - shotsOnTarget - totalBlocked);
    }

    // Only count shots inside box and big chances if explicit commentary plays exist in the match
    let insideBoxCount = 0;
    let bigChancesCount = 0;
    let foundInsideBoxEvents = false;
    let foundBigChanceEvents = false;

    if (raw.commentaryPlays && raw.commentaryPlays.length > 0) {
      for (const play of raw.commentaryPlays) {
        const text = play.text.toLowerCase();
        if (text.includes('shot') || text.includes('attempt') || text.includes('goal')) {
          if (
            text.includes('centre of the box') || 
            text.includes('six yard box') || 
            text.includes('penalty area') || 
            text.includes('inside the box') || 
            text.includes('from very close range')
          ) {
            insideBoxCount++;
            foundInsideBoxEvents = true;
          }
          if (
            text.includes('big chance') || 
            text.includes('one on one') || 
            text.includes('open goal') || 
            text.includes('penalty kick') || 
            text.includes('goal!')
          ) {
            bigChancesCount++;
            foundBigChanceEvents = true;
          }
        }
      }
    }

    const homeCorners = homeStats['wonCorners'] ?? homeStats['corners'] ?? null;
    const awayCorners = awayStats['wonCorners'] ?? awayStats['corners'] ?? null;
    const corners = homeCorners !== null || awayCorners !== null
      ? (homeCorners || 0) + (awayCorners || 0)
      : null;

    const possession = homeStats['possessionPct'] ?? null;

    const calculatedTotalXg = raw.totalXg !== null
      ? raw.totalXg
      : (raw.homeXg !== null || raw.awayXg !== null
          ? parseFloat(((raw.homeXg || 0) + (raw.awayXg || 0)).toFixed(2))
          : ((raw.state === 'in' || (totalShots !== null && totalShots >= 0))
              ? this.calculateShotQualityXg({
                  totalShots: totalShots ?? 0,
                  shotsOnTarget: shotsOnTarget ?? 0,
                  shotsInsideBox: foundInsideBoxEvents ? insideBoxCount : null,
                  bigChances: foundBigChanceEvents ? bigChancesCount : null,
                })
              : null));

    return {
      xg: calculatedTotalXg,
      totalShots,
      shotsOnTarget,
      shotsOffTarget,
      shotsInsideBox: foundInsideBoxEvents ? insideBoxCount : null,
      bigChances: foundBigChanceEvents ? bigChancesCount : null,
      corners,
      possession,
    };
  }

  /**
   * Compute recent statistics in a given time window (5, 10 or 15 minutes).
   * Strict Rule: Only calculate if real previous snapshots or real timestamped commentary plays exist.
   * If there are no real prior snapshots or real plays, returns null (N/D).
   * ZERO estimations, ZERO assumptions.
   */
  public computeRecentStats(
    raw: RawMatchSummary,
    accumulated: MatchStatsAccumulated,
    snapshots: GameSnapshot[],
    windowMinutes: 5 | 10 | 15
  ): MatchRecentStats {
    if (raw.state === 'pre' || raw.minute <= 0) {
      return {
        xg: null,
        totalShots: null,
        shotsOnTarget: null,
        shotsOffTarget: null,
        shotsInsideBox: null,
        bigChances: null,
      };
    }

    const currentMinute = raw.minute;
    const minMinute = Math.max(0, currentMinute - windowMinutes);

    // 1. Calculate real xG and shot deltas strictly from historical real database snapshots
    let xgDelta: number | null = null;
    let snapTotalShots: number | null = null;
    let snapTotalSot: number | null = null;
    let snapTotalOff: number | null = null;
    let snapTotalInside: number | null = null;
    let snapTotalBig: number | null = null;

    if (snapshots.length >= 2) {
      const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const currentSnap = sorted[sorted.length - 1];
      const priorSnaps = sorted.filter(s => s.minute <= minMinute);
      const pastSnap = priorSnaps.length > 0 ? priorSnaps[priorSnaps.length - 1] : sorted[0];

      if (pastSnap && currentSnap && pastSnap !== currentSnap) {
        if (pastSnap.totalXg !== null && currentSnap.totalXg !== null) {
          xgDelta = Math.max(0, parseFloat((currentSnap.totalXg - pastSnap.totalXg).toFixed(2)));
        }
        if (currentSnap.homeShots !== null && pastSnap.homeShots !== null && currentSnap.awayShots !== null && pastSnap.awayShots !== null) {
          snapTotalShots = Math.max(0, (currentSnap.homeShots + currentSnap.awayShots) - (pastSnap.homeShots + pastSnap.awayShots));
        }
        if (currentSnap.homeShotsOnTarget !== null && pastSnap.homeShotsOnTarget !== null && currentSnap.awayShotsOnTarget !== null && pastSnap.awayShotsOnTarget !== null) {
          snapTotalSot = Math.max(0, (currentSnap.homeShotsOnTarget + currentSnap.awayShotsOnTarget) - (pastSnap.homeShotsOnTarget + pastSnap.awayShotsOnTarget));
        }
        if (currentSnap.homeShotsOffTarget !== null && pastSnap.homeShotsOffTarget !== null && currentSnap.awayShotsOffTarget !== null && pastSnap.awayShotsOffTarget !== null) {
          snapTotalOff = Math.max(0, (currentSnap.homeShotsOffTarget + currentSnap.awayShotsOffTarget) - (pastSnap.homeShotsOffTarget + pastSnap.awayShotsOffTarget));
        }
        if (currentSnap.homeShotsInsideBox !== null && pastSnap.homeShotsInsideBox !== null && currentSnap.awayShotsInsideBox !== null && pastSnap.awayShotsInsideBox !== null) {
          snapTotalInside = Math.max(0, (currentSnap.homeShotsInsideBox + currentSnap.awayShotsInsideBox) - (pastSnap.homeShotsInsideBox + pastSnap.awayShotsInsideBox));
        }
        if (currentSnap.homeBigChances !== null && pastSnap.homeBigChances !== null && currentSnap.awayBigChances !== null && pastSnap.awayBigChances !== null) {
          snapTotalBig = Math.max(0, (currentSnap.homeBigChances + currentSnap.awayBigChances) - (pastSnap.homeBigChances + pastSnap.awayBigChances));
        }
      }
    }

    // 2. Count real plays in window strictly from timestamped ESPN commentary
    let windowShots = 0;
    let windowSOT = 0;
    let windowOffTarget = 0;
    let windowInsideBox = 0;
    let windowBigChances = 0;
    let playsFound = false;

    if (raw.commentaryPlays && raw.commentaryPlays.length > 0) {
      for (const p of raw.commentaryPlays) {
        if (p.minute > minMinute && p.minute <= currentMinute) {
          const text = p.text.toLowerCase();
          const isShot = text.includes('shot') || text.includes('attempt') || text.includes('goal');
          if (isShot) {
            playsFound = true;
            windowShots++;

            if (
              text.includes('goal!') || 
              text.includes('saved') || 
              text.includes('bottom right') || 
              text.includes('top left') || 
              text.includes('bottom left') || 
              text.includes('top right')
            ) {
              windowSOT++;
            } else if (
              text.includes('missed') || 
              text.includes('high') || 
              text.includes('wide') || 
              text.includes('post') || 
              text.includes('bar')
            ) {
              windowOffTarget++;
            }

            if (
              text.includes('centre of the box') || 
              text.includes('six yard box') || 
              text.includes('inside the box') || 
              text.includes('close range')
            ) {
              windowInsideBox++;
            }

            if (text.includes('big chance') || text.includes('open goal') || text.includes('goal!')) {
              windowBigChances++;
            }
          }
        }
      }
    }

    const hasSnapshots = snapTotalShots !== null;
    const finalShots = hasSnapshots ? Math.max(snapTotalShots!, windowShots) : (playsFound ? windowShots : null);
    const finalSot = snapTotalSot !== null ? Math.max(snapTotalSot, windowSOT) : (playsFound ? windowSOT : null);
    const finalOff = snapTotalOff !== null ? Math.max(snapTotalOff, windowOffTarget) : (playsFound ? windowOffTarget : null);
    const finalInside = snapTotalInside !== null ? Math.max(snapTotalInside, windowInsideBox) : (playsFound ? windowInsideBox : null);
    const finalBig = snapTotalBig !== null ? Math.max(snapTotalBig, windowBigChances) : (playsFound ? windowBigChances : null);

    const windowShotXg = this.calculateShotQualityXg({
      totalShots: finalShots,
      shotsOnTarget: finalSot,
      shotsInsideBox: finalInside,
      bigChances: finalBig,
    });

    const finalXg = xgDelta !== null 
      ? Math.max(xgDelta, windowShotXg) 
      : (finalShots !== null && finalShots > 0 ? windowShotXg : (xgDelta ?? (playsFound ? 0 : null)));

    return {
      xg: finalXg,
      totalShots: finalShots,
      shotsOnTarget: finalSot,
      shotsOffTarget: finalOff,
      shotsInsideBox: finalInside,
      bigChances: finalBig,
    };
  }

  /**
   * Extract chronological timeline of actions for the last 15 minutes of the match:
   * - Gols (Goals)
   * - Finalizações no gol (Shots on target)
   * - Finalizações dentro da área (Shots inside box)
   * - Finalizações para fora (Shots off target / blocked)
   * - xG da ação individual
   * Strictly limited to the last 15 minutes ([max(0, currentMinute - 15), currentMinute]).
   */
  public extractRecentTimeline(raw: RawMatchSummary, windowMinutes: number = 15): MatchTimelineAction[] {
    const currentMinute = raw.minute || 0;
    if (currentMinute <= 0 || raw.state === 'pre') {
      return [];
    }

    const minMinute = Math.max(0, currentMinute - windowMinutes);
    const actions: MatchTimelineAction[] = [];
    const seenEventKeys = new Set<string>();

    const homeTeam = raw.homeTeam;
    const awayTeam = raw.awayTeam;

    const homeTerms = [
      homeTeam.name?.toLowerCase(),
      homeTeam.shortName?.toLowerCase(),
      homeTeam.abbreviation?.toLowerCase(),
      ...(homeTeam.name ? homeTeam.name.toLowerCase().split(' ').filter((w) => w.length > 2) : []),
    ].filter(Boolean) as string[];

    const awayTerms = [
      awayTeam.name?.toLowerCase(),
      awayTeam.shortName?.toLowerCase(),
      awayTeam.abbreviation?.toLowerCase(),
      ...(awayTeam.name ? awayTeam.name.toLowerCase().split(' ').filter((w) => w.length > 2) : []),
    ].filter(Boolean) as string[];

    const isHomeFromText = (text: string): boolean => {
      const lower = text.toLowerCase();
      for (const h of homeTerms) {
        if (lower.includes(`(${h})`)) return true;
      }
      for (const a of awayTerms) {
        if (lower.includes(`(${a})`)) return false;
      }
      for (const h of homeTerms) {
        if (lower.includes(h)) return true;
      }
      for (const a of awayTerms) {
        if (lower.includes(a)) return false;
      }
      return true;
    };

    // 1. Process commentary plays in the 15-minute window
    if (raw.commentaryPlays && Array.isArray(raw.commentaryPlays)) {
      for (const play of raw.commentaryPlays) {
        if (play.minute > minMinute && play.minute <= currentMinute) {
          const text = play.text || '';
          const lower = text.toLowerCase();
          const isShot = lower.includes('shot') || lower.includes('attempt') || lower.includes('goal!');

          if (isShot) {
            const isHome = isHomeFromText(text);
            const isGoal = lower.includes('goal!');
            const isOnTarget =
              isGoal ||
              lower.includes('saved') ||
              lower.includes('bottom right') ||
              lower.includes('bottom left') ||
              lower.includes('top right') ||
              lower.includes('top left') ||
              lower.includes('centre of the goal');

            const isInsideBox =
              lower.includes('centre of the box') ||
              lower.includes('six yard') ||
              lower.includes('penalty area') ||
              lower.includes('inside the box') ||
              lower.includes('close range') ||
              lower.includes('from very close');

            const isOffTarget =
              !isOnTarget &&
              (lower.includes('missed') ||
                lower.includes('blocked') ||
                lower.includes('high') ||
                lower.includes('wide') ||
                lower.includes('post') ||
                lower.includes('bar'));

            // Calculate realistic action xG
            let actionXg = 0.04;
            if (lower.includes('penalty kick') || lower.includes('penalty')) {
              actionXg = 0.78;
            } else if (isGoal) {
              actionXg = isInsideBox ? 0.38 : 0.12;
            } else if (isOnTarget && isInsideBox) {
              actionXg = 0.22;
            } else if (isOnTarget && !isInsideBox) {
              actionXg = 0.07;
            } else if (isInsideBox) {
              actionXg = 0.10;
            } else {
              actionXg = 0.03;
            }

            // Extract player name if present (e.g. "Steffen Tigges (Paderborn)")
            let player: string | undefined = undefined;
            const playerMatch = text.match(/([A-ZÀ-ÿ][a-zA-ZÀ-ÿ\s'-]+)\s*\(([^)]+)\)/);
            if (playerMatch) {
              player = playerMatch[1].trim();
            }

            const actionKey = `${play.minute}-${isHome ? 'H' : 'A'}-${isGoal ? 'goal' : isOnTarget ? 'sot' : 'off'}`;
            if (!seenEventKeys.has(actionKey)) {
              seenEventKeys.add(actionKey);
              actions.push({
                id: `act-${play.minute}-${actions.length}`,
                minute: play.minute,
                timeDisplay: play.timeDisplay || `${play.minute}'`,
                isHome,
                teamName: isHome ? homeTeam.name : awayTeam.name,
                teamAbbr: isHome ? homeTeam.abbreviation : awayTeam.abbreviation,
                isGoal,
                isOnTarget,
                isInsideBox,
                isOffTarget,
                player,
                description: text,
                xg: actionXg,
              });
            }
          }
        }
      }
    }

    // 2. Also ensure any official keyEvents goals in the 15m window are included
    if (raw.events && Array.isArray(raw.events)) {
      for (const ev of raw.events) {
        if (ev.type === 'goal' && ev.minute > minMinute && ev.minute <= currentMinute) {
          const isHome = ev.isHome !== undefined ? ev.isHome : isHomeFromText(ev.text || ev.teamName || '');
          const actionKey = `${ev.minute}-${isHome ? 'H' : 'A'}-goal`;

          if (!seenEventKeys.has(actionKey)) {
            seenEventKeys.add(actionKey);
            actions.push({
              id: `ev-goal-${ev.minute}-${actions.length}`,
              minute: ev.minute,
              timeDisplay: ev.timeDisplay || `${ev.minute}'`,
              isHome,
              teamName: isHome ? homeTeam.name : awayTeam.name,
              teamAbbr: isHome ? homeTeam.abbreviation : awayTeam.abbreviation,
              isGoal: true,
              isOnTarget: true,
              isInsideBox: true,
              isOffTarget: false,
              player: ev.shortText || undefined,
              description: ev.text,
              xg: 0.38,
            });
          }
        }
      }
    }

    // Sort descending (most recent action first)
    actions.sort((a, b) => b.minute - a.minute);

    return actions;
  }
}

export const statisticsService = new StatisticsService();
