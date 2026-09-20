import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Flame,
  BarChart2,
  Clock,
  Shield,
} from 'lucide-react';
import { LiveMatchData, MatchRecentStats, TabType } from '../types.ts';

interface MatchCardProps {
  match: LiveMatchData;
  currentTab?: TabType;
  onOpenDetailModal?: (match: LiveMatchData) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, currentTab = 'all', onOpenDetailModal }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [statsFilter, setStatsFilter] = useState<'all' | '15' | '10' | '5'>('all');
  const [selectedHistoryLine, setSelectedHistoryLine] = useState<number | null>(null);
  const [filterHomeAway, setFilterHomeAway] = useState(false);
  const [filterLast10, setFilterLast10] = useState(false);
  const [filterLast5, setFilterLast5] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const isFirstRender = useRef(true);

  // Trigger brief visual pulse on real-time data refresh
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setJustUpdated(true);
    const timer = setTimeout(() => setJustUpdated(false), 1200);
    return () => clearTimeout(timer);
  }, [
    match.lastUpdated,
    match.minute,
    match.homeScore,
    match.awayScore,
    match.targetOver.foundOdd,
    match.intensity.xg10,
    match.intensity.xg15,
  ]);

  const {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    displayClock,
    minute,
    competitionName,
    targetOver,
    intensity,
    homeStats,
    awayStats,
    recent10,
    recent15,
    recent5,
    recent5Home,
    recent5Away,
    recent10Home,
    recent10Away,
    recent15Home,
    recent15Away,
    snapshots,
  } = match;

  const r10: MatchRecentStats = recent10 || {
    xg: intensity.xg10,
    totalShots: null,
    shotsOnTarget: null,
    shotsOffTarget: null,
    shotsInsideBox: null,
    bigChances: null,
  };

  const r15: MatchRecentStats = recent15 || {
    xg: intensity.xg15,
    totalShots: null,
    shotsOnTarget: null,
    shotsOffTarget: null,
    shotsInsideBox: null,
    bigChances: null,
  };

  const r5: MatchRecentStats = recent5 || {
    xg: intensity.xg5,
    totalShots: null,
    shotsOnTarget: null,
    shotsOffTarget: null,
    shotsInsideBox: null,
    bigChances: null,
  };

  // Safe display formatter
  const fmt = (val: number | null | undefined, isXg = false): string => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return isXg ? val.toFixed(2) : String(val);
  };

  // Helper for dual comparison bar proportions
  const getProportions = (val1: number | null | undefined, val2: number | null | undefined) => {
    const v1 = val1 !== null && val1 !== undefined && !isNaN(val1) ? Number(val1) : 0;
    const v2 = val2 !== null && val2 !== undefined && !isNaN(val2) ? Number(val2) : 0;
    const total = v1 + v2;
    if (total <= 0) return { p1: 50, p2: 50, hasData: false };
    return {
      p1: Math.max(6, Math.min(94, Math.round((v1 / total) * 100))),
      p2: Math.max(6, Math.min(94, Math.round((v2 / total) * 100))),
      hasData: true,
    };
  };

  // Halftime detection
  const isHalftime =
    displayClock?.toUpperCase().includes('HT') ||
    displayClock?.toUpperCase().includes('HALFTIME') ||
    displayClock?.toUpperCase().includes('INTERVALO');

  // Detecção do minuto do último gol da partida (para aviso em vermelho debaixo do placar)
  const lastGoalNotice = useMemo(() => {
    const totalGoals = (homeScore ?? 0) + (awayScore ?? 0);
    if (totalGoals === 0) return null;

    // 1. Verificar eventos da partida (ESPN keyEvents e details)
    const goalEvents = (match.events || []).filter(
      (e) => e.type === 'goal' || e.shortText?.toLowerCase().includes('goal') || e.text?.toLowerCase().includes('goal')
    );

    if (goalEvents.length > 0) {
      const latest = goalEvents.reduce(
        (max, g) => (!max || g.minute > max.minute ? g : max),
        goalEvents[0]
      );
      if (latest) {
        const minDisplay = latest.timeDisplay ? latest.timeDisplay.trim() : `${latest.minute}'`;
        const cleanMin = minDisplay.endsWith("'") ? minDisplay : `${minDisplay}'`;
        return `Último gol saiu aos ${cleanMin}`;
      }
    }

    // 2. Fallback: verificar se snapshots registraram aumento no placar total
    if (snapshots && snapshots.length >= 2) {
      const sortedSnaps = [...snapshots].sort((a, b) => a.minute - b.minute);
      for (let i = sortedSnaps.length - 1; i > 0; i--) {
        const prev = sortedSnaps[i - 1];
        const curr = sortedSnaps[i];
        if (curr.homeScore + curr.awayScore > prev.homeScore + prev.awayScore) {
          return `Último gol saiu aos ${curr.minute}'`;
        }
      }
    }

    return null;
  }, [homeScore, awayScore, match.events, snapshots]);

  // Filtro de janela de tempo dinâmico para a área expandida de estatísticas
  const filteredStats = useMemo(() => {
    if (statsFilter === 'all') {
      return {
        isWindowed: false as const,
        windowMinutes: null,
        windowPeriod: `0' ao ${minute}'`,
        totalXg: (homeStats?.xg ?? 0) + (awayStats?.xg ?? 0),
        intensityTag: intensity.primaryTag,
        home: {
          ...homeStats,
          goals: homeScore,
        },
        away: {
          ...awayStats,
          goals: awayScore,
        },
      };
    }

    const winMin = Number(statsFilter) as 5 | 10 | 15;
    const fromMin = Math.max(0, minute - winMin);

    const homeRec = winMin === 5 ? recent5Home : winMin === 10 ? recent10Home : recent15Home;
    const awayRec = winMin === 5 ? recent5Away : winMin === 10 ? recent10Away : recent15Away;
    const totalRec = winMin === 5 ? r5 : winMin === 10 ? r10 : r15;

    let snapHomeXg = 0;
    let snapAwayXg = 0;
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
    let snapHomeGoals = 0;
    let snapAwayGoals = 0;

    if (snapshots && snapshots.length >= 2) {
      const sorted = [...snapshots].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const currentSnap = sorted[sorted.length - 1];
      const priorSnaps = sorted.filter(s => s.minute <= fromMin);
      const pastSnap = priorSnaps.length > 0 ? priorSnaps[priorSnaps.length - 1] : sorted[0];

      if (pastSnap && currentSnap && pastSnap !== currentSnap) {
        if (currentSnap.homeXg !== null && pastSnap.homeXg !== null) {
          snapHomeXg = Math.max(0, parseFloat((currentSnap.homeXg - pastSnap.homeXg).toFixed(2)));
        }
        if (currentSnap.awayXg !== null && pastSnap.awayXg !== null) {
          snapAwayXg = Math.max(0, parseFloat((currentSnap.awayXg - pastSnap.awayXg).toFixed(2)));
        }
        if (currentSnap.homeShots !== null && pastSnap.homeShots !== null) {
          snapHomeShots = Math.max(0, currentSnap.homeShots - pastSnap.homeShots);
        }
        if (currentSnap.awayShots !== null && pastSnap.awayShots !== null) {
          snapAwayShots = Math.max(0, currentSnap.awayShots - pastSnap.awayShots);
        }
        if (currentSnap.homeShotsOnTarget !== null && pastSnap.homeShotsOnTarget !== null) {
          snapHomeSot = Math.max(0, currentSnap.homeShotsOnTarget - pastSnap.homeShotsOnTarget);
        }
        if (currentSnap.awayShotsOnTarget !== null && pastSnap.awayShotsOnTarget !== null) {
          snapAwaySot = Math.max(0, currentSnap.awayShotsOnTarget - pastSnap.awayShotsOnTarget);
        }
        if (currentSnap.homeShotsOffTarget !== null && pastSnap.homeShotsOffTarget !== null) {
          snapHomeOff = Math.max(0, currentSnap.homeShotsOffTarget - pastSnap.homeShotsOffTarget);
        }
        if (currentSnap.awayShotsOffTarget !== null && pastSnap.awayShotsOffTarget !== null) {
          snapAwayOff = Math.max(0, currentSnap.awayShotsOffTarget - pastSnap.awayShotsOffTarget);
        }
        if (currentSnap.homeShotsInsideBox !== null && pastSnap.homeShotsInsideBox !== null) {
          snapHomeInside = Math.max(0, currentSnap.homeShotsInsideBox - pastSnap.homeShotsInsideBox);
        }
        if (currentSnap.awayShotsInsideBox !== null && pastSnap.awayShotsInsideBox !== null) {
          snapAwayInside = Math.max(0, currentSnap.awayShotsInsideBox - pastSnap.awayShotsInsideBox);
        }
        if (currentSnap.homeBigChances !== null && pastSnap.homeBigChances !== null) {
          snapHomeBig = Math.max(0, currentSnap.homeBigChances - pastSnap.homeBigChances);
        }
        if (currentSnap.awayBigChances !== null && pastSnap.awayBigChances !== null) {
          snapAwayBig = Math.max(0, currentSnap.awayBigChances - pastSnap.awayBigChances);
        }
        snapHomeGoals = Math.max(0, currentSnap.homeScore - pastSnap.homeScore);
        snapAwayGoals = Math.max(0, currentSnap.awayScore - pastSnap.awayScore);
      }
    }

    // Count cards and goals from match.events in the window
    let eventHomeYellow = 0;
    let eventAwayYellow = 0;
    let eventHomeRed = 0;
    let eventAwayRed = 0;
    let eventHomeGoals = 0;
    let eventAwayGoals = 0;

    if (match.events && match.events.length > 0) {
      for (const evt of match.events) {
        if (evt.minute > fromMin && evt.minute <= minute) {
          if (evt.type === 'yellow-card') {
            if (evt.isHome) eventHomeYellow++; else eventAwayYellow++;
          } else if (evt.type === 'red-card') {
            if (evt.isHome) eventHomeRed++; else eventAwayRed++;
          } else if (evt.type === 'goal') {
            if (evt.isHome) eventHomeGoals++; else eventAwayGoals++;
          }
        }
      }
    }

    const effectiveHomeXg = homeRec?.xg !== null && homeRec?.xg !== undefined ? homeRec.xg : snapHomeXg;
    const effectiveAwayXg = awayRec?.xg !== null && awayRec?.xg !== undefined ? awayRec.xg : snapAwayXg;
    const effectiveTotalXg =
      totalRec?.xg !== null && totalRec?.xg !== undefined
        ? totalRec.xg
        : parseFloat((effectiveHomeXg + effectiveAwayXg).toFixed(2));

    const histRate = match.history?.historicalEstimatePercent ?? null;
    let megaThresh = winMin === 15 ? 0.35 : winMin === 10 ? 0.25 : 0.20;
    let hotThresh = winMin === 15 ? 0.20 : winMin === 10 ? 0.15 : 0.12;

    if (histRate !== null && histRate !== undefined) {
      if (histRate >= 70) {
        megaThresh = winMin === 15 ? 0.26 : winMin === 10 ? 0.18 : 0.14;
        hotThresh = winMin === 15 ? 0.15 : winMin === 10 ? 0.11 : 0.08;
      } else if (histRate >= 55) {
        megaThresh = winMin === 15 ? 0.30 : winMin === 10 ? 0.22 : 0.17;
        hotThresh = winMin === 15 ? 0.18 : winMin === 10 ? 0.13 : 0.10;
      } else if (histRate < 40) {
        megaThresh = winMin === 15 ? 0.42 : winMin === 10 ? 0.30 : 0.24;
        hotThresh = winMin === 15 ? 0.26 : winMin === 10 ? 0.19 : 0.15;
      }
    }

    const winTag =
      effectiveTotalXg >= megaThresh ? 'MEGA_HOT' : effectiveTotalXg >= hotThresh ? 'HOT' : 'NORMAL';

    // Strict window statistics:
    // If we have recent data from server or snapshots, use them (0 if nothing occurred).
    // NEVER fall back to full match cumulative stats (homeStats/awayStats)!
    const finalHomeShots = homeRec?.totalShots ?? snapHomeShots ?? 0;
    const finalAwayShots = awayRec?.totalShots ?? snapAwayShots ?? 0;
    const finalHomeSot = homeRec?.shotsOnTarget ?? snapHomeSot ?? 0;
    const finalAwaySot = awayRec?.shotsOnTarget ?? snapAwaySot ?? 0;
    const finalHomeOff = homeRec?.shotsOffTarget ?? snapHomeOff ?? Math.max(0, finalHomeShots - finalHomeSot);
    const finalAwayOff = awayRec?.shotsOffTarget ?? snapAwayOff ?? Math.max(0, finalAwayShots - finalAwaySot);
    const finalHomeInside = homeRec?.shotsInsideBox ?? snapHomeInside ?? 0;
    const finalAwayInside = awayRec?.shotsInsideBox ?? snapAwayInside ?? 0;
    const finalHomeBlocked = homeRec?.blockedShots ?? Math.max(0, finalHomeShots - finalHomeSot - finalHomeOff);
    const finalAwayBlocked = awayRec?.blockedShots ?? Math.max(0, finalAwayShots - finalAwaySot - finalAwayOff);
    const finalHomeOutside = homeRec?.shotsOutsideBox ?? Math.max(0, finalHomeShots - finalHomeInside);
    const finalAwayOutside = awayRec?.shotsOutsideBox ?? Math.max(0, finalAwayShots - finalAwayInside);
    const finalHomeBig = homeRec?.bigChances ?? snapHomeBig ?? 0;
    const finalAwayBig = awayRec?.bigChances ?? snapAwayBig ?? 0;

    return {
      isWindowed: true as const,
      windowMinutes: winMin,
      windowPeriod: `${fromMin}' ao ${minute}'`,
      totalXg: effectiveTotalXg,
      intensityTag: winTag,
      home: {
        xg: effectiveHomeXg,
        totalShots: finalHomeShots,
        shotsOnTarget: finalHomeSot,
        shotsOffTarget: finalHomeOff,
        blockedShots: finalHomeBlocked,
        shotsInsideBox: finalHomeInside,
        shotsOutsideBox: finalHomeOutside,
        bigChances: finalHomeBig,
        corners: homeRec?.corners ?? 0,
        possession: null,
        passes: null,
        fouls: homeRec?.fouls ?? 0,
        yellowCards: Math.max(homeRec?.yellowCards ?? 0, eventHomeYellow),
        redCards: Math.max(homeRec?.redCards ?? 0, eventHomeRed),
        goals: Math.max(snapHomeGoals, eventHomeGoals, homeRec?.goals ?? 0),
        offsides: null,
      },
      away: {
        xg: effectiveAwayXg,
        totalShots: finalAwayShots,
        shotsOnTarget: finalAwaySot,
        shotsOffTarget: finalAwayOff,
        blockedShots: finalAwayBlocked,
        shotsInsideBox: finalAwayInside,
        shotsOutsideBox: finalAwayOutside,
        bigChances: finalAwayBig,
        corners: awayRec?.corners ?? 0,
        possession: null,
        passes: null,
        fouls: awayRec?.fouls ?? 0,
        yellowCards: Math.max(awayRec?.yellowCards ?? 0, eventAwayYellow),
        redCards: Math.max(awayRec?.redCards ?? 0, eventAwayRed),
        goals: Math.max(snapAwayGoals, eventAwayGoals, awayRec?.goals ?? 0),
        offsides: null,
      },
    };
  }, [
    statsFilter,
    minute,
    homeStats,
    awayStats,
    homeScore,
    awayScore,
    recent5Home,
    recent10Home,
    recent15Home,
    recent5Away,
    recent10Away,
    recent15Away,
    r5,
    r10,
    r15,
    snapshots,
    match.events,
    intensity.primaryTag,
  ]);

  const xgBreakdownRows = useMemo(() => {
    const getWinXg = (winMin: 5 | 10 | 15) => {
      const homeRec = winMin === 5 ? recent5Home : winMin === 10 ? recent10Home : recent15Home;
      const awayRec = winMin === 5 ? recent5Away : winMin === 10 ? recent10Away : recent15Away;
      const totalRec = winMin === 5 ? r5 : winMin === 10 ? r10 : r15;

      let snapH = 0;
      let snapA = 0;
      if (snapshots && snapshots.length >= 2) {
        const sorted = [...snapshots].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const currentSnap = sorted[sorted.length - 1];
        const fromMin = Math.max(0, minute - winMin);
        const priorSnaps = sorted.filter((s) => s.minute <= fromMin);
        const pastSnap = priorSnaps.length > 0 ? priorSnaps[priorSnaps.length - 1] : sorted[0];

        if (pastSnap && currentSnap && pastSnap !== currentSnap) {
          if (currentSnap.homeXg !== null && pastSnap.homeXg !== null) {
            snapH = Math.max(0, parseFloat((currentSnap.homeXg - pastSnap.homeXg).toFixed(2)));
          }
          if (currentSnap.awayXg !== null && pastSnap.awayXg !== null) {
            snapA = Math.max(0, parseFloat((currentSnap.awayXg - pastSnap.awayXg).toFixed(2)));
          }
        }
      }

      const homeVal = homeRec?.xg !== null && homeRec?.xg !== undefined ? homeRec.xg : snapH;
      const awayVal = awayRec?.xg !== null && awayRec?.xg !== undefined ? awayRec.xg : snapA;
      const totalVal =
        totalRec?.xg !== null && totalRec?.xg !== undefined
          ? totalRec.xg
          : parseFloat((homeVal + awayVal).toFixed(2));

      return { home: homeVal, away: awayVal, total: totalVal };
    };

    const w15 = getWinXg(15);
    const w10 = getWinXg(10);
    const w5 = getWinXg(5);

    const totalGameHome = homeStats?.xg ?? 0;
    const totalGameAway = awayStats?.xg ?? 0;
    const totalGame = parseFloat((totalGameHome + totalGameAway).toFixed(2));

    return [
      {
        id: 'game',
        label: 'xG Total',
        home: totalGameHome,
        away: totalGameAway,
        total: totalGame,
        isCumulative: true,
        props: getProportions(totalGameHome, totalGameAway),
      },
      {
        id: '15',
        label: "xG 15'",
        home: w15.home,
        away: w15.away,
        total: w15.total,
        isCumulative: false,
        props: getProportions(w15.home, w15.away),
      },
      {
        id: '10',
        label: "xG 10'",
        home: w10.home,
        away: w10.away,
        total: w10.total,
        isCumulative: false,
        props: getProportions(w10.home, w10.away),
      },
      {
        id: '5',
        label: "xG 5'",
        home: w5.home,
        away: w5.away,
        total: w5.total,
        isCumulative: false,
        props: getProportions(w5.home, w5.away),
      },
    ];
  }, [
    homeStats?.xg,
    awayStats?.xg,
    recent15Home?.xg,
    recent15Away?.xg,
    recent10Home?.xg,
    recent10Away?.xg,
    recent5Home?.xg,
    recent5Away?.xg,
    r15.xg,
    r10.xg,
    r5.xg,
    snapshots,
    minute,
  ]);

  const xgProps = getProportions(homeStats?.xg, awayStats?.xg);

  // "NA ABA 'TODOS' QUANDO NAO FOR LIMITE, NEM A FRENTE, NEM EXPOSICAO.. POR PADRÃO MOSTRAR HISTORICO DO MAIOR CENARIO DE GOLS ACIMA DE 50%"
  const isSpecialWindow =
    match.tab === 'over_limite' || match.tab === 'over_frente' || match.tab === 'over_longa';
  const shouldUseHighestScenario = currentTab === 'all' && !isSpecialWindow;

  const historyLineScenarios = useMemo(() => {
    if (!match.history?.isAvailable || !match.history.home || !match.history.away) {
      return {
        lines: [] as Array<{
          line: number;
          homeRate: number;
          homeHits: number;
          homeTotal: number;
          awayRate: number;
          awayHits: number;
          awayTotal: number;
          estimate: number;
        }>,
        highestLineAbove50: targetOver.targetLine,
        homeCount: 0,
        awayCount: 0,
      };
    }

    const rawHomeMatches = match.history.home.auditMatches || [];
    const rawAwayMatches = match.history.away.auditMatches || [];

    // Filtro 1: "Home x Away" (Mandante somente em casa, Visitante somente fora)
    let homeMatches = filterHomeAway
      ? rawHomeMatches.filter((m) => m.isHome)
      : [...rawHomeMatches];
    let awayMatches = filterHomeAway
      ? rawAwayMatches.filter((m) => !m.isHome)
      : [...rawAwayMatches];

    // Filtros 2 e 3: "Last 5" / "Last 10" (podendo ser as 3 juntas, 2 ativadas ou somente 1 ativada)
    // Se ambos ativos (Last 5 e Last 10), o limite conjunto é 5 jogos (interseção)
    const limit = filterLast5 && filterLast10 ? 5 : filterLast5 ? 5 : filterLast10 ? 10 : null;
    if (limit !== null) {
      homeMatches = homeMatches.slice(0, limit);
      awayMatches = awayMatches.slice(0, limit);
    }

    const homeTotal = homeMatches.length;
    const awayTotal = awayMatches.length;
    const isAnyFilterActive = filterHomeAway || filterLast5 || filterLast10;

    const defaultLines = [0.5, 1.5, 2.5, 3.5, 4.5];

    const lines = defaultLines.map((line) => {
      let homeRate = 0;
      let homeHits = 0;
      let awayRate = 0;
      let awayHits = 0;

      if (rawHomeMatches.length > 0) {
        homeHits = homeMatches.filter((m) => m.totalGoals > line).length;
        homeRate = homeTotal > 0 ? parseFloat(((homeHits / homeTotal) * 100).toFixed(1)) : 0;
      } else {
        const homeItem = (match.history?.home?.ratesByLine || []).find((r) => Math.abs(r.line - line) < 0.05);
        homeRate = homeItem ? homeItem.ratePercent : 0;
        homeHits = homeItem ? homeItem.hits : 0;
      }

      if (rawAwayMatches.length > 0) {
        awayHits = awayMatches.filter((m) => m.totalGoals > line).length;
        awayRate = awayTotal > 0 ? parseFloat(((awayHits / awayTotal) * 100).toFixed(1)) : 0;
      } else {
        const awayItem = (match.history?.away?.ratesByLine || []).find((r) => Math.abs(r.line - line) < 0.05);
        awayRate = awayItem ? awayItem.ratePercent : 0;
        awayHits = awayItem ? awayItem.hits : 0;
      }

      let estimate = 0;
      if (
        !isAnyFilterActive &&
        Math.abs(line - match.history!.targetLine) < 0.05 &&
        match.history!.historicalEstimatePercent !== null
      ) {
        estimate = match.history!.historicalEstimatePercent;
      } else {
        if (homeTotal > 0 && awayTotal > 0) {
          estimate = parseFloat(((homeRate + awayRate) / 2).toFixed(1));
        } else if (homeTotal > 0) {
          estimate = homeRate;
        } else if (awayTotal > 0) {
          estimate = awayRate;
        }
      }

      return {
        line,
        homeRate,
        homeHits,
        homeTotal: rawHomeMatches.length > 0 ? homeTotal : (match.history?.home?.totalGamesAnalyzed || 0),
        awayRate,
        awayHits,
        awayTotal: rawAwayMatches.length > 0 ? awayTotal : (match.history?.away?.totalGamesAnalyzed || 0),
        estimate,
      };
    });

    // Encontrar todas as linhas com estimativa >= 50%
    const linesAbove50 = lines.filter((l) => l.estimate >= 50.0);
    linesAbove50.sort((a, b) => b.line - a.line);

    // Maior cenário >= 50%, ou fallback para 0.5
    const highestLineAbove50 = linesAbove50.length > 0 ? linesAbove50[0].line : 0.5;

    return {
      lines,
      highestLineAbove50,
      homeCount: homeTotal,
      awayCount: awayTotal,
    };
  }, [match.history, targetOver.targetLine, filterHomeAway, filterLast5, filterLast10]);

  const defaultHistoryLine = shouldUseHighestScenario
    ? historyLineScenarios.highestLineAbove50
    : targetOver.targetLine;

  const activeHistoryLine = selectedHistoryLine !== null ? selectedHistoryLine : defaultHistoryLine;

  const activeLineData = useMemo(() => {
    const found = historyLineScenarios.lines.find((l) => Math.abs(l.line - activeHistoryLine) < 0.05);
    if (found) return found;

    return {
      line: activeHistoryLine,
      homeRate: match.history?.home?.overTargetRatePercent ?? 0,
      homeHits: match.history?.home?.overTargetHits ?? 0,
      homeTotal: match.history?.home?.totalGamesAnalyzed ?? 0,
      awayRate: match.history?.away?.overTargetRatePercent ?? 0,
      awayHits: match.history?.away?.overTargetHits ?? 0,
      awayTotal: match.history?.away?.totalGamesAnalyzed ?? 0,
      estimate: match.history?.historicalEstimatePercent ?? 0,
    };
  }, [historyLineScenarios, activeHistoryLine, match.history]);

  return (
    <motion.div
      id={`match-card-${match.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all font-mono text-slate-200 flex flex-col justify-between"
    >
      {/* Real-time update highlight pulse */}
      {justUpdated && (
        <motion.div
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0 border-2 border-emerald-400/60 rounded-3xl pointer-events-none z-30 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        />
      )}

      <div>
        {/* LINHA 1 — CABEÇALHO DO JOGO */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/80 rounded-t-3xl">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[180px] sm:max-w-[240px]">
            {competitionName || 'CAMPEONATO'}
          </div>

          <div className="flex items-center gap-2">
            {/* AO VIVO / MINUTO */}
            <div className="flex items-center gap-1.5 text-xs font-black">
              {isHalftime ? (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                  INT
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[11px] sm:text-xs">AO VIVO {displayClock || `${minute}'`}</span>
                </span>
              )}
            </div>

            {/* TAG DE INTENSIDADE COM CONFLUÊNCIA HISTÓRICA */}
            {intensity.primaryTag === 'MEGA_HOT' ? (
              <span
                className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-600 text-white shadow-sm shadow-rose-900/50 uppercase tracking-wider animate-pulse cursor-help"
                title={intensity.confluenceReason || 'Mega Hot: Confluência de xG recente com histórico Over da linha indicada'}
              >
                <Flame className="w-3 h-3 fill-white shrink-0" />
                <span>MEGA HOT</span>
                {intensity.historicalOverRate ? (
                  <span className="text-[9px] bg-rose-950/70 border border-rose-400/40 px-1.5 py-0.2 rounded-full font-mono text-rose-100 font-bold" title={`Histórico na linha ${targetOver.targetLine}: ${intensity.historicalOverRate}% Over`}>
                    {intensity.historicalOverRate}% Over
                  </span>
                ) : null}
              </span>
            ) : intensity.primaryTag === 'HOT' ? (
              <span
                className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow-sm shadow-amber-900/40 uppercase tracking-wider cursor-help"
                title={intensity.confluenceReason || 'Hot: Pressão recente ativa confirmada por histórico favorável'}
              >
                <Flame className="w-3 h-3 fill-slate-950 shrink-0" />
                <span>HOT</span>
                {intensity.historicalOverRate ? (
                  <span className="text-[9px] bg-amber-950/30 border border-amber-950/40 px-1.5 py-0.2 rounded-full font-mono text-slate-950 font-bold" title={`Histórico na linha ${targetOver.targetLine}: ${intensity.historicalOverRate}% Over`}>
                    {intensity.historicalOverRate}% Over
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60 uppercase font-bold">
                NORMAL
              </span>
            )}
          </div>
        </div>

        {/* LINHA 2 — TIME VS TIME LADO A LADO */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800/80">
          {/* Card Centralizado: Mandante VS Visitante Lado a Lado */}
          <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800 hover:border-slate-750 transition-colors shadow-sm">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
              {/* Mandante (Esquerda) */}
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-750 flex items-center justify-center p-1 shrink-0 shadow-inner">
                  {homeTeam?.logoUrl ? (
                    <img
                      src={homeTeam.logoUrl}
                      alt={homeTeam.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Shield className="w-4 h-4 text-emerald-400/70" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className="text-xs sm:text-sm font-bold text-white truncate block font-sans tracking-tight"
                    title={homeTeam?.name}
                  >
                    {homeTeam?.name}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 font-sans block mt-0.5">
                    MANDANTE
                  </span>
                </div>
              </div>

              {/* Placar Central com Tempo & Último Gol */}
              <div className="flex flex-col items-center justify-center px-1 text-center min-w-[90px] sm:min-w-[110px]">
                <div className="flex items-center gap-1 sm:gap-1.5 font-mono">
                  <span className="px-2 sm:px-2.5 py-0.5 rounded-xl bg-slate-850 border border-slate-700 text-sm sm:text-base font-bold text-white min-w-[28px] sm:min-w-[32px] text-center shadow-inner">
                    {homeScore ?? 0}
                  </span>
                  <span className="text-slate-500 font-black text-xs">x</span>
                  <span className="px-2 sm:px-2.5 py-0.5 rounded-xl bg-slate-850 border border-slate-700 text-sm sm:text-base font-bold text-white min-w-[28px] sm:min-w-[32px] text-center shadow-inner">
                    {awayScore ?? 0}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 mt-1 font-mono">
                  {displayClock || `${minute}'`}
                </span>
                {lastGoalNotice && (
                  <span className="text-[9px] font-bold text-rose-400 font-mono tracking-tight mt-0.5 whitespace-nowrap">
                    {lastGoalNotice}
                  </span>
                )}
              </div>

              {/* Visitante (Direita) */}
              <div className="flex items-center justify-end gap-2 sm:gap-2.5 min-w-0 text-right">
                <div className="min-w-0 flex-1">
                  <span
                    className="text-xs sm:text-sm font-bold text-white truncate block font-sans tracking-tight"
                    title={awayTeam?.name}
                  >
                    {awayTeam?.name}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-sky-400 font-sans block mt-0.5">
                    VISITANTE
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-750 flex items-center justify-center p-1 shrink-0 shadow-inner">
                  {awayTeam?.logoUrl ? (
                    <img
                      src={awayTeam.logoUrl}
                      alt={awayTeam.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Shield className="w-4 h-4 text-sky-400/70" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LINHA 3 — SOMENTE EXPECTED GOALS (xG) NA FRENTE DO CARD */}
        <div className="mx-3 my-2.5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 shadow-inner">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[10px] font-bold uppercase tracking-wider pb-2 mb-2 border-b border-slate-800/70 text-slate-400">
            <div className="flex items-center gap-1.5">
              {homeTeam?.logoUrl ? (
                <img
                  src={homeTeam.logoUrl}
                  alt={homeTeam.name}
                  className="w-3.5 h-3.5 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              )}
              <span className="text-emerald-400 truncate max-w-[90px] font-sans font-semibold">
                {homeTeam?.name || 'MANDANTE'}
              </span>
            </div>
            <span className="px-2 text-center text-slate-300 font-bold font-sans">
              EXPECTED GOALS (xG)
            </span>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-sky-400 truncate max-w-[90px] font-sans font-semibold">
                {awayTeam?.name || 'VISITANTE'}
              </span>
              {awayTeam?.logoUrl ? (
                <img
                  src={awayTeam.logoUrl}
                  alt={awayTeam.name}
                  className="w-3.5 h-3.5 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="h-2 w-2 rounded-full bg-sky-400"></span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {xgBreakdownRows.map((row) => {
              const homeWins = (row.home ?? 0) > (row.away ?? 0);
              const awayWins = (row.away ?? 0) > (row.home ?? 0);

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 px-2.5 rounded-xl bg-slate-900/60 border border-slate-850"
                >
                  {/* Lado Esquerdo: Valor Mandante + Mini Barra */}
                  <div className="flex items-center gap-2 justify-start">
                    <span
                      className={`font-mono font-bold text-xs px-2.5 py-1 rounded-xl border min-w-[42px] text-center ${
                        homeWins
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-850 border-slate-750 text-emerald-400'
                      }`}
                    >
                      {row.isCumulative ? fmt(row.home, true) : `+${fmt(row.home, true)}`}
                    </span>
                    {row.props.hasData && (
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex justify-end max-w-[65px] hidden sm:flex">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                          style={{ width: `${row.props.p1}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Centro: Nome da Métrica */}
                  <div className="text-center font-mono text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wide px-1 whitespace-nowrap">
                    {row.label}: <strong className="text-emerald-400">+{row.total.toFixed(2)}</strong>
                  </div>

                  {/* Lado Direito: Mini Barra + Valor Visitante */}
                  <div className="flex items-center gap-2 justify-end">
                    {row.props.hasData && (
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex justify-start max-w-[65px] hidden sm:flex">
                        <div
                          className="h-full rounded-full bg-sky-400 transition-all duration-300"
                          style={{ width: `${row.props.p2}%` }}
                        />
                      </div>
                    )}
                    <span
                      className={`font-mono font-bold text-xs px-2.5 py-1 rounded-xl border min-w-[42px] text-center ${
                        awayWins
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                          : 'bg-slate-850 border-slate-750 text-sky-400'
                      }`}
                    >
                      {row.isCumulative ? fmt(row.away, true) : `+${fmt(row.away, true)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>



        {/* LINHA 4.5 — HISTÓRICO OVER COM MAIOR CENÁRIO ≥50% POR PADRÃO */}
        <div className="mx-3 mb-2.5 p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/60 gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-amber-400 font-bold text-xs" role="img" aria-label="Histórico">📊</span>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-200 uppercase tracking-wider font-sans whitespace-nowrap">
                Histórico Over {activeHistoryLine}
              </span>
              {shouldUseHighestScenario && Math.abs(activeHistoryLine - historyLineScenarios.highestLineAbove50) < 0.05 && (
                <span className="text-[8px] font-black px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap" title="Maior linha com probabilidade estimada ≥ 50%">
                  ≥50%
                </span>
              )}
              {match.history?.isReducedSample && (
                <span className="text-[8px] sm:text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                  Amostra curta
                </span>
              )}
            </div>

            {/* Pills interativas para inspecionar outros cenários */}
            {historyLineScenarios.lines.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {historyLineScenarios.lines.slice(0, 4).map((l) => {
                  const isSelected = Math.abs(l.line - activeHistoryLine) < 0.05;
                  const isAbove50 = l.estimate >= 50.0;
                  return (
                    <button
                      key={l.line}
                      type="button"
                      onClick={() => setSelectedHistoryLine(isSelected ? null : l.line)}
                      title={`Over ${l.line}: ${l.estimate}% estimativa (${l.homeRate}% casa / ${l.awayRate}% fora)`}
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow-sm font-black ring-1 ring-amber-400'
                          : isAbove50
                          ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
                      }`}
                    >
                      +{l.line}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* SELETOR DE FILTROS HISTÓRICOS: HOME X AWAY | LAST 10 | LAST 5 */}
          {match.history?.isAvailable && (
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {/* 1. HOME X AWAY */}
              <button
                type="button"
                onClick={() => setFilterHomeAway(!filterHomeAway)}
                title="Filtrar somente jogos do Mandante em Casa e Visitante Fora"
                className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl text-[10px] font-sans transition-all cursor-pointer whitespace-nowrap border ${
                  filterHomeAway
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold shadow-sm ring-1 ring-emerald-500/30'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-300 hover:bg-slate-850'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${filterHomeAway ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span>Home × Away</span>
              </button>

              {/* 2. LAST 10 */}
              <button
                type="button"
                onClick={() => setFilterLast10(!filterLast10)}
                title="Filtrar os últimos 10 jogos disputados"
                className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl text-[10px] font-sans transition-all cursor-pointer whitespace-nowrap border ${
                  filterLast10
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold shadow-sm ring-1 ring-sky-500/30'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-300 hover:bg-slate-850'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${filterLast10 ? 'bg-sky-400' : 'bg-slate-600'}`} />
                <span>Last 10</span>
              </button>

              {/* 3. LAST 5 */}
              <button
                type="button"
                onClick={() => setFilterLast5(!filterLast5)}
                title="Filtrar os últimos 5 jogos disputados"
                className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl text-[10px] font-sans transition-all cursor-pointer whitespace-nowrap border ${
                  filterLast5
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold shadow-sm ring-1 ring-amber-500/30'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-300 hover:bg-slate-850'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${filterLast5 ? 'bg-amber-400' : 'bg-slate-600'}`} />
                <span>Last 5</span>
              </button>
            </div>
          )}

          {match.history?.isAvailable && match.history.home && match.history.away ? (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center font-mono">
              {/* 1. Mandante */}
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-400 uppercase truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  <span className="truncate">{homeTeam?.shortName || homeTeam?.abbreviation || 'CASA'}</span>
                </div>
                <div className="text-sm sm:text-base font-black text-emerald-300 my-0.5">
                  {activeLineData.homeRate}%
                </div>
                <div className="text-[9px] text-slate-400">
                  {activeLineData.homeHits}/{activeLineData.homeTotal} jogos
                </div>
              </div>

              {/* 2. Partida / Cenário Ponderado */}
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between">
                <div className="text-[10px] font-bold text-amber-300 uppercase tracking-tight truncate">
                  Partida
                </div>
                <div className="text-base sm:text-lg font-black text-amber-300 my-0.5">
                  {activeLineData.estimate !== null
                    ? `${activeLineData.estimate}%`
                    : 'N/D'}
                </div>
                <div className="text-[9px] text-amber-400/80">
                  Estimativa
                </div>
              </div>

              {/* 3. Visitante */}
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-sky-400 uppercase truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0"></span>
                  <span className="truncate">{awayTeam?.shortName || awayTeam?.abbreviation || 'FORA'}</span>
                </div>
                <div className="text-sm sm:text-base font-black text-sky-300 my-0.5">
                  {activeLineData.awayRate}%
                </div>
                <div className="text-[9px] text-slate-400">
                  {activeLineData.awayHits}/{activeLineData.awayTotal} jogos
                </div>
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-[10px] font-mono text-slate-400">
              {match.history?.statusMessage || 'Histórico indisponível para esta competição na temporada.'}
            </div>
          )}

          {/* Mercado Alvo OVER e Odd Ao Vivo Integrados com a Probabilidade */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex items-center justify-between gap-2 font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider font-sans whitespace-nowrap">
                Linha Alvo:
              </span>
              <span className="text-xs sm:text-sm font-black text-white bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
                OVER {activeHistoryLine}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[9px] font-sans font-medium text-slate-400 hidden sm:inline whitespace-nowrap truncate max-w-[130px]" title="Casa de apostas / Provedor">
                Fonte: {targetOver.providerName || 'DraftKings'}
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 border border-emerald-400 shadow-md shadow-emerald-950/40">
                <span className="text-[9px] font-black uppercase text-slate-950/70 font-sans">
                  ODD
                </span>
                <span className="text-sm sm:text-base font-black tracking-tight text-slate-950">
                  {targetOver.foundOdd ? targetOver.foundOdd.toFixed(2) : '1.80'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA EXPANDIDA COMPLETA COM FILTROS DE JANELA (VIA BOTÃO [Estatísticas]) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden bg-slate-950 border-t border-slate-800/80"
          >
            <div className="p-3 sm:p-4">
              {/* Formato solicitado com filtros (Jogo Todo, Últimos 15', 10', 5') e comparativos */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3.5">
                {/* Cabeçalho com Título e Filtros de Janela de Tempo */}
                <div className="space-y-2.5 pb-2.5 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white font-sans">
                        ESTATÍSTICAS DA PARTIDA
                      </span>
                    </div>
                    {filteredStats.isWindowed ? (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        {filteredStats.windowPeriod}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400">
                        Jogo Todo
                      </span>
                    )}
                  </div>

                  {/* Filtros de Janela Temporal: Jogo Todo, Últimos 15', 10', 5' */}
                  <div className="w-full grid grid-cols-4 bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
                    {[
                      { id: 'all', label: 'Jogo Todo', shortLabel: 'Jogo Todo' },
                      { id: '15', label: "Últimos 15'", shortLabel: "Últ. 15'" },
                      { id: '10', label: "Últimos 10'", shortLabel: "Últ. 10'" },
                      { id: '5', label: "Últimos 5'", shortLabel: "Últ. 5'" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        id={`btn-stats-filter-${f.id}-${match.id}`}
                        type="button"
                        onClick={() => setStatsFilter(f.id as 'all' | '15' | '10' | '5')}
                        title={f.label}
                        className={`w-full min-w-0 py-1.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-center transition-all cursor-pointer truncate ${
                          statsFilter === f.id
                            ? 'bg-emerald-500 text-slate-950 shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                        }`}
                      >
                        <span className="hidden sm:inline">{f.label}</span>
                        <span className="sm:hidden">{f.shortLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Barra dos Times e Contexto da Janela */}
                <div className="flex items-center justify-between px-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                    <span className="font-bold text-emerald-400 truncate max-w-[110px] sm:max-w-[150px] font-sans">
                      {homeTeam?.name}
                    </span>
                  </div>

                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 font-sans text-center px-2">
                    {filteredStats.isWindowed
                      ? `Período: ${filteredStats.windowPeriod}`
                      : `Acumulado (0' ao ${minute}')`}
                  </span>

                  <div className="flex items-center gap-2 justify-end">
                    <span className="font-bold text-sky-400 truncate max-w-[110px] sm:max-w-[150px] font-sans text-right">
                      {awayTeam?.name}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                  </div>
                </div>

                {/* Banner Explicativo quando janela de tempo está ativa */}
                {filteredStats.isWindowed && (
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800/90 px-3 py-2 rounded-xl text-xs font-sans">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[11px]">
                        Recorte dos <strong className="text-white">últimos {filteredStats.windowMinutes} minutos</strong> ({filteredStats.windowPeriod})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400 font-medium">
                        xG: <strong className="text-emerald-400">+{fmt(filteredStats.totalXg, true)}</strong>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase whitespace-nowrap border ${
                          filteredStats.intensityTag === 'MEGA_HOT'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : filteredStats.intensityTag === 'HOT'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {filteredStats.intensityTag === 'MEGA_HOT'
                          ? '🔥🔥 MEGA HOT'
                          : filteredStats.intensityTag === 'HOT'
                          ? '🔥 HOT'
                          : 'NORMAL'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStatsFilter('all')}
                        className="text-[10px] text-slate-400 hover:text-emerald-400 underline cursor-pointer ml-0.5"
                      >
                        Jogo todo
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista Completa de Métricas com Barras Duplas Proporcionais */}
                <div className="space-y-2 text-xs font-mono">
                  {[
                    {
                      label: 'Expected Goals (xG)',
                      home: `+${fmt(filteredStats.home.xg, true)}`,
                      away: `+${fmt(filteredStats.away.xg, true)}`,
                      rawHome: filteredStats.home.xg,
                      rawAway: filteredStats.away.xg,
                      isHighlight: true,
                    },
                    ...(filteredStats.isWindowed && ((filteredStats.home.goals ?? 0) > 0 || (filteredStats.away.goals ?? 0) > 0)
                      ? [
                          {
                            label: 'Gols na janela',
                            home: fmt(filteredStats.home.goals),
                            away: fmt(filteredStats.away.goals),
                            rawHome: filteredStats.home.goals,
                            rawAway: filteredStats.away.goals,
                            isHighlight: true,
                          },
                        ]
                      : []),
                    {
                      label: 'Finalizações',
                      home: fmt(filteredStats.home.totalShots),
                      away: fmt(filteredStats.away.totalShots),
                      rawHome: filteredStats.home.totalShots,
                      rawAway: filteredStats.away.totalShots,
                    },
                    {
                      label: 'No gol (No alvo)',
                      home: fmt(filteredStats.home.shotsOnTarget),
                      away: fmt(filteredStats.away.shotsOnTarget),
                      rawHome: filteredStats.home.shotsOnTarget,
                      rawAway: filteredStats.away.shotsOnTarget,
                    },
                    {
                      label: 'Fora do gol',
                      home: fmt(filteredStats.home.shotsOffTarget),
                      away: fmt(filteredStats.away.shotsOffTarget),
                      rawHome: filteredStats.home.shotsOffTarget,
                      rawAway: filteredStats.away.shotsOffTarget,
                    },
                    {
                      label: 'Finalizações bloqueadas',
                      home: fmt(filteredStats.home.blockedShots),
                      away: fmt(filteredStats.away.blockedShots),
                      rawHome: filteredStats.home.blockedShots,
                      rawAway: filteredStats.away.blockedShots,
                    },
                    {
                      label: 'Dentro da área',
                      home: fmt(filteredStats.home.shotsInsideBox),
                      away: fmt(filteredStats.away.shotsInsideBox),
                      rawHome: filteredStats.home.shotsInsideBox,
                      rawAway: filteredStats.away.shotsInsideBox,
                    },
                    {
                      label: 'Fora da área',
                      home: fmt(filteredStats.home.shotsOutsideBox),
                      away: fmt(filteredStats.away.shotsOutsideBox),
                      rawHome: filteredStats.home.shotsOutsideBox,
                      rawAway: filteredStats.away.shotsOutsideBox,
                    },
                    {
                      label: 'Grandes chances',
                      home: fmt(filteredStats.home.bigChances),
                      away: fmt(filteredStats.away.bigChances),
                      rawHome: filteredStats.home.bigChances,
                      rawAway: filteredStats.away.bigChances,
                    },
                    {
                      label: 'Escanteios',
                      home: fmt(filteredStats.home.corners),
                      away: fmt(filteredStats.away.corners),
                      rawHome: filteredStats.home.corners,
                      rawAway: filteredStats.away.corners,
                    },
                    ...(!filteredStats.isWindowed
                      ? [
                          {
                            label: 'Posse de bola (%)',
                            home: filteredStats.home.possession ? `${filteredStats.home.possession}%` : 'N/D',
                            away: filteredStats.away.possession ? `${filteredStats.away.possession}%` : 'N/D',
                            rawHome: filteredStats.home.possession,
                            rawAway: filteredStats.away.possession,
                          },
                          {
                            label: 'Passes',
                            home: fmt(filteredStats.home.passes),
                            away: fmt(filteredStats.away.passes),
                            rawHome: filteredStats.home.passes,
                            rawAway: filteredStats.away.passes,
                          },
                        ]
                      : []),
                    {
                      label: 'Faltas',
                      home: fmt(filteredStats.home.fouls),
                      away: fmt(filteredStats.away.fouls),
                      rawHome: filteredStats.home.fouls,
                      rawAway: filteredStats.away.fouls,
                    },
                    {
                      label: 'Cartões amarelos',
                      home: fmt(filteredStats.home.yellowCards ?? 0),
                      away: fmt(filteredStats.away.yellowCards ?? 0),
                      rawHome: filteredStats.home.yellowCards ?? 0,
                      rawAway: filteredStats.away.yellowCards ?? 0,
                    },
                    {
                      label: 'Cartões vermelhos',
                      home: fmt(filteredStats.home.redCards ?? 0),
                      away: fmt(filteredStats.away.redCards ?? 0),
                      rawHome: filteredStats.home.redCards ?? 0,
                      rawAway: filteredStats.away.redCards ?? 0,
                    },
                    ...(!filteredStats.isWindowed
                      ? [
                          {
                            label: 'Impedimentos',
                            home: fmt(filteredStats.home.offsides),
                            away: fmt(filteredStats.away.offsides),
                            rawHome: filteredStats.home.offsides,
                            rawAway: filteredStats.away.offsides,
                          },
                        ]
                      : []),
                  ].map((row, idx) => {
                    const props = getProportions(row.rawHome, row.rawAway);
                    const homeWins = (row.rawHome ?? 0) > (row.rawAway ?? 0);
                    const awayWins = (row.rawAway ?? 0) > (row.rawHome ?? 0);

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="grid grid-cols-[60px_1fr_60px] items-center text-xs">
                          <span
                            className={`font-mono text-left font-bold ${
                              homeWins
                                ? 'text-emerald-400 font-extrabold'
                                : row.isHighlight
                                ? 'text-emerald-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {row.home}
                          </span>
                          <span className="text-center font-sans text-[11px] font-semibold text-slate-300 truncate px-1">
                            {row.label}
                          </span>
                          <span
                            className={`font-mono text-right font-bold ${
                              awayWins
                                ? 'text-sky-400 font-extrabold'
                                : row.isHighlight
                                ? 'text-sky-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {row.away}
                          </span>
                        </div>

                        <div className="flex h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              homeWins ? 'bg-emerald-500' : 'bg-slate-700'
                            }`}
                            style={{ width: `${props.p1}%` }}
                          />
                          <div
                            className={`h-full transition-all duration-300 ${
                              awayWins ? 'bg-sky-500' : 'bg-slate-700'
                            }`}
                            style={{ width: `${props.p2}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LINHA 5 — AÇÕES RÁPIDAS (Borda inferior arredondada) */}
      <div className="px-4 py-3 bg-slate-950 flex items-center border-t border-slate-800/80 rounded-b-3xl">
        <button
          id={`btn-expand-${match.id}`}
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl border text-xs font-semibold font-sans transition-all cursor-pointer ${
            isExpanded
              ? 'bg-slate-800 text-white border-slate-700 shadow-inner'
              : 'bg-slate-900 hover:bg-slate-850 active:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
          }`}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              <span>Ocultar Estatísticas</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Estatísticas</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
