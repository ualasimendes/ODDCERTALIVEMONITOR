import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  TrendingUp,
  Flame,
  Activity,
  Target,
  BarChart2,
  Info,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Layers,
  Award,
} from 'lucide-react';
import {
  LiveMatchData,
  MatchHistoricalProbability,
  MatchEventItem,
  TeamAuditMatchItem,
} from '../types.ts';
import { fetchGameHistory } from '../services/api.ts';

interface MatchDetailModalProps {
  match: LiveMatchData | null;
  onClose: () => void;
}

type DetailTab = 'estatisticas' | 'resumo' | 'eventos' | 'historico';

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({ match, onClose }) => {
  if (!match) return null;

  const {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    displayClock,
    minute,
    competitionName,
    statusDetail,
    tab,
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
    events,
  } = match;

  // Tabs de navegação estilo livescore - ESTATÍSTICAS selecionada por padrão (Item 2)
  const [activeTab, setActiveTab] = useState<DetailTab>('estatisticas');

  // Controle de linha dinâmica para o módulo de probabilidade histórica
  const [selectedLine, setSelectedLine] = useState<number>(targetOver.targetLine);
  const [currentHistory, setCurrentHistory] = useState<MatchHistoricalProbability | undefined>(
    match.history
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Time selecionado para auditar jogos no histórico (Item 12)
  const [auditTeam, setAuditTeam] = useState<'home' | 'away'>('home');

  useEffect(() => {
    setSelectedLine(targetOver.targetLine);
    setCurrentHistory(match.history);
  }, [match.id, targetOver.targetLine, match.history]);

  const handleSelectLine = async (line: number) => {
    setSelectedLine(line);
    if (line === targetOver.targetLine && match.history) {
      setCurrentHistory(match.history);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const data = await fetchGameHistory(match.id, line);
      setCurrentHistory(data);
    } catch (e) {
      console.warn('Falha ao buscar histórico para a linha', line, e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fmt = (val: number | null | undefined, isXg = false): string => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return isXg ? val.toFixed(2) : String(val);
  };

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

  // Regras de Intensidade Estritas (Item 6 da especificação)
  const getWindowIntensity = (
    xg: number | null | undefined,
    minutes: 5 | 10 | 15
  ): 'MEGA_HOT' | 'HOT' | 'NORMAL' => {
    if (xg === null || xg === undefined || isNaN(xg) || xg <= 0) return 'NORMAL';
    const histRate = currentHistory?.historicalEstimatePercent ?? null;

    let megaThreshold = minutes === 15 ? 0.35 : minutes === 10 ? 0.25 : 0.20;
    let hotThreshold = minutes === 15 ? 0.20 : minutes === 10 ? 0.15 : 0.12;

    if (histRate !== null && histRate !== undefined) {
      if (histRate >= 70) {
        // Confluência Máxima (Histórico Over >= 70%)
        megaThreshold = minutes === 15 ? 0.26 : minutes === 10 ? 0.18 : 0.14;
        hotThreshold = minutes === 15 ? 0.15 : minutes === 10 ? 0.11 : 0.08;
      } else if (histRate >= 55) {
        // Confluência Favorável (55% a 69.9%)
        megaThreshold = minutes === 15 ? 0.30 : minutes === 10 ? 0.22 : 0.17;
        hotThreshold = minutes === 15 ? 0.18 : minutes === 10 ? 0.13 : 0.10;
      } else if (histRate < 40) {
        // Filtro Anti-Falso-Positivo: Perfil Under (< 40%) exige pressão ao vivo extrema
        megaThreshold = minutes === 15 ? 0.42 : minutes === 10 ? 0.30 : 0.24;
        hotThreshold = minutes === 15 ? 0.26 : minutes === 10 ? 0.19 : 0.15;
      }
    }

    if (xg >= megaThreshold) return 'MEGA_HOT';
    if (xg >= hotThreshold) return 'HOT';
    return 'NORMAL';
  };

  const r5 = recent5 || {
    xg: intensity.xg5,
    totalShots: null,
    shotsOnTarget: null,
    shotsOffTarget: null,
    shotsInsideBox: null,
    bigChances: null,
  };
  const r10 = recent10 || {
    xg: intensity.xg10,
    totalShots: null,
    shotsOnTarget: null,
    shotsOffTarget: null,
    shotsInsideBox: null,
    bigChances: null,
  };
  const r15 = recent15 || {
    xg: intensity.xg15,
    totalShots: null,
    shotsOnTarget: null,
    shotsOffTarget: null,
    shotsInsideBox: null,
    bigChances: null,
  };

  const intensity15 = getWindowIntensity(r15.xg, 15);
  const intensity10 = getWindowIntensity(r10.xg, 10);
  const intensity5 = getWindowIntensity(r5.xg, 5);

  const tabNameHuman =
    tab === 'over_limite'
      ? 'LIMITE'
      : tab === 'over_frente'
      ? 'A FRENTE'
      : tab === 'over_longa'
      ? 'EXPOSIÇÃO'
      : 'AO VIVO';

  const tabRuleHuman =
    tab === 'over_limite'
      ? '+1 gol'
      : tab === 'over_frente'
      ? '+2 gols'
      : tab === 'over_longa'
      ? '+3 ou mais gols'
      : 'Cenário live';

  // Eventos reais da partida (Item 13) - ordenados com os mais recentes no topo
  const matchEvents: MatchEventItem[] = useMemo(() => {
    if (!events || events.length === 0) return [];
    return [...events].sort((a, b) => b.minute - a.minute);
  }, [events]);

  // Filtro de janela de tempo nas estatísticas: 'all' | '15' | '10' | '5'
  const [statsFilter, setStatsFilter] = useState<'all' | '15' | '10' | '5'>('all');

  const filteredStats = useMemo(() => {
    if (statsFilter === 'all') {
      return {
        isWindowed: false as const,
        windowMinutes: null,
        windowLabel: 'Jogo Todo',
        windowPeriod: `0' ao ${minute}'`,
        totalXg: (homeStats?.xg ?? 0) + (awayStats?.xg ?? 0),
        intensityTag: 'NORMAL' as const,
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
    const toMin = minute;

    // Dados específicos por equipe para esta janela
    const homeRec = winMin === 5 ? recent5Home : winMin === 10 ? recent10Home : recent15Home;
    const awayRec = winMin === 5 ? recent5Away : winMin === 10 ? recent10Away : recent15Away;
    const totalRec = winMin === 5 ? r5 : winMin === 10 ? r10 : r15;

    // Snapshot fallback se algum dado estiver ausente
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

    if (match.snapshots && match.snapshots.length >= 2) {
      const sorted = [...match.snapshots].sort(
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
      }
    }

    // Eventos da janela (gols, cartões)
    let homeWindowGoals = 0;
    let awayWindowGoals = 0;
    let homeWindowYellow = 0;
    let awayWindowYellow = 0;
    let homeWindowRed = 0;
    let awayWindowRed = 0;

    if (events && events.length > 0) {
      for (const ev of events) {
        if (ev.minute > fromMin && ev.minute <= toMin) {
          if (ev.type === 'goal') {
            if (ev.isHome) homeWindowGoals++; else awayWindowGoals++;
          } else if (ev.type === 'yellow-card') {
            if (ev.isHome) homeWindowYellow++; else awayWindowYellow++;
          } else if (ev.type === 'red-card') {
            if (ev.isHome) homeWindowRed++; else awayWindowRed++;
          }
        }
      }
    }

    const finalHomeXg = homeRec?.xg ?? (snapHomeXg > 0 ? snapHomeXg : 0);
    const finalAwayXg = awayRec?.xg ?? (snapAwayXg > 0 ? snapAwayXg : 0);
    const finalHomeShots = homeRec?.totalShots ?? snapHomeShots ?? 0;
    const finalAwayShots = awayRec?.totalShots ?? snapAwayShots ?? 0;
    const finalHomeSot = homeRec?.shotsOnTarget ?? snapHomeSot ?? 0;
    const finalAwaySot = awayRec?.shotsOnTarget ?? snapAwaySot ?? 0;
    const finalHomeOff = homeRec?.shotsOffTarget ?? snapHomeOff ?? Math.max(0, finalHomeShots - finalHomeSot);
    const finalAwayOff = awayRec?.shotsOffTarget ?? snapAwayOff ?? Math.max(0, finalAwayShots - finalAwaySot);
    const finalHomeBlocked = homeRec?.blockedShots ?? Math.max(0, finalHomeShots - finalHomeSot - finalHomeOff);
    const finalAwayBlocked = awayRec?.blockedShots ?? Math.max(0, finalAwayShots - finalAwaySot - finalAwayOff);
    const finalHomeInside = homeRec?.shotsInsideBox ?? snapHomeInside ?? 0;
    const finalAwayInside = awayRec?.shotsInsideBox ?? snapAwayInside ?? 0;
    const finalHomeOutside = homeRec?.shotsOutsideBox ?? Math.max(0, finalHomeShots - finalHomeInside);
    const finalAwayOutside = awayRec?.shotsOutsideBox ?? Math.max(0, finalAwayShots - finalAwayInside);
    const finalHomeBig = homeRec?.bigChances ?? snapHomeBig ?? 0;
    const finalAwayBig = awayRec?.bigChances ?? snapAwayBig ?? 0;
    const finalHomeCorners = homeRec?.corners ?? 0;
    const finalAwayCorners = awayRec?.corners ?? 0;
    const finalHomeYellow = Math.max(homeRec?.yellowCards ?? 0, homeWindowYellow);
    const finalAwayYellow = Math.max(awayRec?.yellowCards ?? 0, awayWindowYellow);
    const finalHomeRed = Math.max(homeRec?.redCards ?? 0, homeWindowRed);
    const finalAwayRed = Math.max(awayRec?.redCards ?? 0, awayWindowRed);
    const finalHomeGoals = Math.max(homeRec?.goals ?? 0, homeWindowGoals);
    const finalAwayGoals = Math.max(awayRec?.goals ?? 0, awayWindowGoals);
    const finalHomeFouls = homeRec?.fouls ?? 0;
    const finalAwayFouls = awayRec?.fouls ?? 0;

    const intensityTag = winMin === 15 ? intensity15 : winMin === 10 ? intensity10 : intensity5;
    const totalWinXg = totalRec?.xg !== null && totalRec?.xg !== undefined 
      ? totalRec.xg 
      : parseFloat((finalHomeXg + finalAwayXg).toFixed(2));

    return {
      isWindowed: true as const,
      windowMinutes: winMin,
      windowLabel: `Últimos ${winMin}'`,
      windowPeriod: `${fromMin}' ao ${toMin}'`,
      intensityTag,
      totalXg: totalWinXg,
      home: {
        xg: finalHomeXg,
        totalShots: finalHomeShots,
        shotsOnTarget: finalHomeSot,
        shotsOffTarget: finalHomeOff,
        blockedShots: finalHomeBlocked,
        shotsInsideBox: finalHomeInside,
        shotsOutsideBox: finalHomeOutside,
        bigChances: finalHomeBig,
        corners: finalHomeCorners,
        yellowCards: finalHomeYellow,
        redCards: finalHomeRed,
        goals: finalHomeGoals,
        fouls: finalHomeFouls,
      },
      away: {
        xg: finalAwayXg,
        totalShots: finalAwayShots,
        shotsOnTarget: finalAwaySot,
        shotsOffTarget: finalAwayOff,
        blockedShots: finalAwayBlocked,
        shotsInsideBox: finalAwayInside,
        shotsOutsideBox: finalAwayOutside,
        bigChances: finalAwayBig,
        corners: finalAwayCorners,
        yellowCards: finalAwayYellow,
        redCards: finalAwayRed,
        goals: finalAwayGoals,
        fouls: finalAwayFouls,
      },
    };
  }, [
    statsFilter,
    homeStats,
    awayStats,
    recent5Home,
    recent5Away,
    recent10Home,
    recent10Away,
    recent15Home,
    recent15Away,
    r5,
    r10,
    r15,
    minute,
    match.snapshots,
    events,
    intensity15,
    intensity10,
    intensity5,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-center-title"
    >
      <div
        id="match-center-modal"
        className="bg-slate-900 border border-slate-750 rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-4 flex flex-col max-h-[92vh]"
      >
        {/* ========================================================================= */}
        {/* 1. CABEÇALHO DA PARTIDA (Item 1) */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 sm:px-6 pt-4 pb-5 rounded-t-3xl">
          {/* Linha Topo: Campeonato, Rodada e Status Ao Vivo */}
          <div className="flex items-center justify-between gap-3 text-xs mb-3 font-sans">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-300 uppercase tracking-wide truncate">
                {competitionName}
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                {statusDetail || 'Partida Oficial'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold font-mono text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>AO VIVO</span>
                <span>{displayClock || `${minute}'`}</span>
              </div>

              <button
                id="btn-close-match-center"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Fechar Match Center"
                title="Fechar (Voltar à lista)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Placar Central Limpo e Sem Poluição (Conceito Livescore) */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6 py-2">
            {/* Time Mandante */}
            <div className="flex items-center justify-end gap-2 sm:gap-4 text-right min-w-0">
              <div className="min-w-0">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    CASA
                  </span>
                </div>
                <h2
                  id="match-center-title"
                  className="text-base sm:text-2xl font-black text-white truncate font-sans tracking-tight"
                >
                  {homeTeam.name}
                </h2>
              </div>
              {homeTeam.logoUrl && (
                <img
                  src={homeTeam.logoUrl}
                  alt={homeTeam.name}
                  className="w-9 h-9 sm:w-12 sm:h-12 object-contain shrink-0 drop-shadow"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}
            </div>

            {/* Placar em Destaque */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 px-3 sm:px-6 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-inner font-mono">
              <span className="text-2xl sm:text-4xl font-black text-white min-w-[28px] text-center">
                {homeScore}
              </span>
              <span className="text-slate-500 font-bold text-lg sm:text-2xl">×</span>
              <span className="text-2xl sm:text-4xl font-black text-white min-w-[28px] text-center">
                {awayScore}
              </span>
            </div>

            {/* Time Visitante */}
            <div className="flex items-center justify-start gap-2 sm:gap-4 text-left min-w-0">
              {awayTeam.logoUrl && (
                <img
                  src={awayTeam.logoUrl}
                  alt={awayTeam.name}
                  className="w-9 h-9 sm:w-12 sm:h-12 object-contain shrink-0 drop-shadow"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center justify-start gap-1.5 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    FORA
                  </span>
                </div>
                <h2 className="text-base sm:text-2xl font-black text-white truncate font-sans tracking-tight">
                  {awayTeam.name}
                </h2>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. ABAS DA PARTIDA (Navegação Horizontal - Item 2) */}
        {/* ========================================================================= */}
        <div className="bg-slate-950/70 border-b border-slate-800 px-4 sm:px-6 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none font-sans">
          {[
            { id: 'estatisticas', label: 'ESTATÍSTICAS', icon: BarChart2 },
            { id: 'resumo', label: 'RESUMO', icon: Activity },
            { id: 'eventos', label: 'EVENTOS', icon: Clock },
            { id: 'historico', label: 'HISTÓRICO', icon: Calendar },
          ].map((tabItem) => {
            const Icon = tabItem.icon;
            const isActive = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                id={`tab-match-center-${tabItem.id}`}
                onClick={() => setActiveTab(tabItem.id as DetailTab)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tabItem.label}</span>
                {tabItem.id === 'eventos' && matchEvents.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {matchEvents.length}
                  </span>
                )}
                {tabItem.id === 'historico' && currentHistory?.sampleSizeTotalGames ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono hidden sm:inline">
                    {currentHistory.sampleSizeTotalGames}j
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* CONTEÚDO DAS ABAS (Corpo do Modal com Scroll) */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ======================================================================= */}
          {/* ABA 1: ESTATÍSTICAS (Padrão, Casa × Fora + Módulo Over + Pressão)      */}
          {/* ======================================================================= */}
          {activeTab === 'estatisticas' && (
            <div className="space-y-6">
              {/* Layout Responsivo: Duas Colunas no Desktop (Item 10) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* COLUNA ESQUERDA: ESTATÍSTICAS CLÁSSICAS CASA × FORA (Item 3) */}
                <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                  {/* Cabeçalho com Título e Filtros de Janela de Tempo (5', 10', 15', Jogo Todo) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white font-sans">
                        ESTATÍSTICAS DA PARTIDA
                      </span>
                    </div>

                    {/* Filtros de Janela Temporal: Jogo Todo, Últimos 15', 10', 5' */}
                    <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg gap-1 self-start sm:self-auto">
                      {[
                        { id: 'all', label: 'Jogo Todo' },
                        { id: '15', label: "Últimos 15'" },
                        { id: '10', label: "Últimos 10'" },
                        { id: '5', label: "Últimos 5'" },
                      ].map((f) => (
                        <button
                          key={f.id}
                          id={`btn-stats-filter-${f.id}`}
                          onClick={() => setStatsFilter(f.id as 'all' | '15' | '10' | '5')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                            statsFilter === f.id
                              ? 'bg-emerald-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Barra dos Times e Contexto da Janela */}
                  <div className="flex items-center justify-between px-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                      <span className="font-bold text-emerald-400 truncate max-w-[120px] sm:max-w-[170px] font-sans">
                        {homeTeam.name}
                      </span>
                    </div>

                    <span className="text-[11px] font-semibold text-slate-400 font-sans text-center px-2">
                      {filteredStats.isWindowed
                        ? `Período: ${filteredStats.windowPeriod}`
                        : `Acumulado (0' ao ${minute}')`}
                    </span>

                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-bold text-sky-400 truncate max-w-[120px] sm:max-w-[170px] font-sans text-right">
                        {awayTeam.name}
                      </span>
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-400"></span>
                    </div>
                  </div>

                  {/* Banner Explicativo quando um filtro de janela (5', 10', 15') está ativo */}
                  {filteredStats.isWindowed && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800/90 px-3 py-2 rounded-lg text-xs font-sans">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          Recorte dos <strong className="text-white">últimos {filteredStats.windowMinutes} minutos</strong> ({filteredStats.windowPeriod})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-400 font-medium">
                          xG do período: <strong className="text-emerald-400">+{fmt(filteredStats.totalXg, true)}</strong>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase whitespace-nowrap border ${
                            filteredStats.intensityTag === 'MEGA_HOT'
                              ? intensity.hasRecentGoal
                                ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : filteredStats.intensityTag === 'HOT'
                              ? intensity.hasRecentGoal
                                ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {filteredStats.intensityTag === 'MEGA_HOT'
                            ? intensity.hasRecentGoal
                              ? '⚠️ MEGA HOT (PÓS-GOL)'
                              : '🔥🔥 MEGA HOT (PRÉ-GOL)'
                            : filteredStats.intensityTag === 'HOT'
                            ? intensity.hasRecentGoal
                              ? '⚠️ HOT (PÓS-GOL)'
                              : '🔥 HOT (PRÉ-GOL)'
                            : 'NORMAL'}
                        </span>
                        <button
                          onClick={() => setStatsFilter('all')}
                          className="text-[11px] text-slate-400 hover:text-emerald-400 underline cursor-pointer ml-1"
                          title="Restaurar visualização completa da partida"
                        >
                          Ver jogo todo
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de Métricas com Barras Proporcionais */}
                  <div className="space-y-2.5 text-xs font-mono">
                    {(filteredStats.isWindowed
                      ? [
                          {
                            label: 'Expected Goals (xG)',
                            home: `+${fmt(filteredStats.home.xg, true)}`,
                            away: `+${fmt(filteredStats.away.xg, true)}`,
                            rawHome: filteredStats.home.xg,
                            rawAway: filteredStats.away.xg,
                            isHighlight: true,
                          },
                          ...((filteredStats.home.goals ?? 0) > 0 || (filteredStats.away.goals ?? 0) > 0
                            ? [
                                {
                                  label: 'Gols marcados na janela',
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
                            isTarget: true,
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
                            isAmber: true,
                          },
                          ...(filteredStats.home.corners !== null || filteredStats.away.corners !== null
                            ? [
                                {
                                  label: 'Escanteios',
                                  home: fmt(filteredStats.home.corners),
                                  away: fmt(filteredStats.away.corners),
                                  rawHome: filteredStats.home.corners,
                                  rawAway: filteredStats.away.corners,
                                },
                              ]
                            : []),
                          ...(filteredStats.home.fouls !== null || filteredStats.away.fouls !== null
                            ? [
                                {
                                  label: 'Faltas',
                                  home: fmt(filteredStats.home.fouls),
                                  away: fmt(filteredStats.away.fouls),
                                  rawHome: filteredStats.home.fouls,
                                  rawAway: filteredStats.away.fouls,
                                },
                              ]
                            : []),
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
                            isRed: true,
                          },
                        ]
                      : [
                          {
                            label: 'Expected Goals (xG)',
                            home: fmt(homeStats?.xg, true),
                            away: fmt(awayStats?.xg, true),
                            rawHome: homeStats?.xg,
                            rawAway: awayStats?.xg,
                            isHighlight: true,
                          },
                          {
                            label: 'Finalizações',
                            home: fmt(homeStats?.totalShots),
                            away: fmt(awayStats?.totalShots),
                            rawHome: homeStats?.totalShots,
                            rawAway: awayStats?.totalShots,
                          },
                          {
                            label: 'No gol (No alvo)',
                            home: fmt(homeStats?.shotsOnTarget),
                            away: fmt(awayStats?.shotsOnTarget),
                            rawHome: homeStats?.shotsOnTarget,
                            rawAway: awayStats?.shotsOnTarget,
                            isTarget: true,
                          },
                          {
                            label: 'Fora do gol',
                            home: fmt(homeStats?.shotsOffTarget),
                            away: fmt(awayStats?.shotsOffTarget),
                            rawHome: homeStats?.shotsOffTarget,
                            rawAway: awayStats?.shotsOffTarget,
                          },
                          {
                            label: 'Finalizações bloqueadas',
                            home: fmt(homeStats?.blockedShots),
                            away: fmt(awayStats?.blockedShots),
                            rawHome: homeStats?.blockedShots,
                            rawAway: awayStats?.blockedShots,
                          },
                          {
                            label: 'Dentro da área',
                            home: fmt(homeStats?.shotsInsideBox),
                            away: fmt(awayStats?.shotsInsideBox),
                            rawHome: homeStats?.shotsInsideBox,
                            rawAway: awayStats?.shotsInsideBox,
                          },
                          {
                            label: 'Fora da área',
                            home: fmt(homeStats?.shotsOutsideBox),
                            away: fmt(awayStats?.shotsOutsideBox),
                            rawHome: homeStats?.shotsOutsideBox,
                            rawAway: awayStats?.shotsOutsideBox,
                          },
                          {
                            label: 'Grandes chances',
                            home: fmt(homeStats?.bigChances),
                            away: fmt(awayStats?.bigChances),
                            rawHome: homeStats?.bigChances,
                            rawAway: awayStats?.bigChances,
                            isAmber: true,
                          },
                          {
                            label: 'Escanteios',
                            home: fmt(homeStats?.corners),
                            away: fmt(awayStats?.corners),
                            rawHome: homeStats?.corners,
                            rawAway: awayStats?.corners,
                          },
                          {
                            label: 'Posse de bola (%)',
                            home: homeStats?.possession ? `${homeStats.possession}%` : '—',
                            away: awayStats?.possession ? `${awayStats.possession}%` : '—',
                            rawHome: homeStats?.possession,
                            rawAway: awayStats?.possession,
                          },
                          {
                            label: 'Passes',
                            home: fmt(homeStats?.passes),
                            away: fmt(awayStats?.passes),
                            rawHome: homeStats?.passes,
                            rawAway: awayStats?.passes,
                          },
                          {
                            label: 'Faltas',
                            home: fmt(homeStats?.fouls),
                            away: fmt(awayStats?.fouls),
                            rawHome: homeStats?.fouls,
                            rawAway: awayStats?.fouls,
                          },
                          {
                            label: 'Cartões amarelos',
                            home: fmt(homeStats?.yellowCards ?? 0),
                            away: fmt(awayStats?.yellowCards ?? 0),
                            rawHome: homeStats?.yellowCards ?? 0,
                            rawAway: awayStats?.yellowCards ?? 0,
                          },
                          {
                            label: 'Cartões vermelhos',
                            home: fmt(homeStats?.redCards ?? 0),
                            away: fmt(awayStats?.redCards ?? 0),
                            rawHome: homeStats?.redCards ?? 0,
                            rawAway: awayStats?.redCards ?? 0,
                            isRed: true,
                          },
                          {
                            label: 'Impedimentos',
                            home: fmt(homeStats?.offsides),
                            away: fmt(awayStats?.offsides),
                            rawHome: homeStats?.offsides,
                            rawAway: awayStats?.offsides,
                          },
                        ]
                    ).map((row, i) => {
                      const props = getProportions(row.rawHome, row.rawAway);
                      const homeWins = (row.rawHome ?? 0) > (row.rawAway ?? 0);
                      const awayWins = (row.rawAway ?? 0) > (row.rawHome ?? 0);

                      return (
                        <div key={i} className="space-y-1">
                          {/* Valores numéricos e rótulo central */}
                          <div className="grid grid-cols-[60px_1fr_60px] items-center text-xs">
                            <span
                              className={`font-mono font-bold text-left ${
                                homeWins
                                  ? 'text-emerald-400 font-extrabold'
                                  : row.isHighlight
                                  ? 'text-emerald-300'
                                  : 'text-slate-300'
                              }`}
                            >
                              {row.home}
                            </span>

                            <span className="text-center font-sans text-[11px] font-semibold text-slate-300">
                              {row.label}
                            </span>

                            <span
                              className={`font-mono font-bold text-right ${
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

                          {/* Barra de Proporção Visual Central */}
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

                {/* COLUNA DIREITA: ANÁLISE OVER + PRESSÃO RECENTE + HISTÓRICO DA LINHA (Itens 4, 5, 6) */}
                <div className="lg:col-span-5 space-y-6">
                  {/* ================================================================= */}
                  {/* 4. NOSSO MÓDULO PRINCIPAL: ANÁLISE OVER (Item 4) */}
                  {/* ================================================================= */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">
                          🎯 ANÁLISE OVER
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase font-mono">
                        {tabNameHuman}
                      </span>
                    </div>

                    {/* Dados estruturados do cenário */}
                    <div className="space-y-2.5 text-xs font-mono">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-850">
                        <span className="text-slate-400 font-sans">Cenário do jogo:</span>
                        <span className="font-bold text-white">
                          {minute}' • Placar {homeScore} × {awayScore}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-850">
                        <span className="text-slate-400 font-sans">Regra da aba:</span>
                        <span className="font-bold text-emerald-400">{tabRuleHuman}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-emerald-500/40 bg-emerald-500/5">
                        <span className="text-slate-300 font-sans font-semibold">
                          Linha correspondente:
                        </span>
                        <span className="font-extrabold text-sm text-emerald-400">
                          OVER {targetOver.targetLine}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center shadow-inner">
                          <span className="text-[10px] text-emerald-400 font-bold uppercase block font-sans tracking-wider">
                            Odd Ao Vivo:
                          </span>
                          <span className="text-base sm:text-lg font-black text-emerald-300 block mt-0.5 font-mono">
                            {targetOver.foundOdd ? targetOver.foundOdd.toFixed(2) : '1.80'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                            Fonte: {targetOver.providerName || 'DraftKings'}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-850 text-center">
                          <span className="text-[10px] text-slate-400 block font-sans">
                            Odd de referência:
                          </span>
                          <span className="text-sm font-bold text-slate-300 block mt-0.5">
                            {targetOver.referenceOdd.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            Fonte: OddCerta Modelo
                          </span>
                        </div>
                      </div>

                      {/* Status da Odd */}
                      <div className="p-2.5 rounded-lg text-center border font-sans text-xs">
                        {targetOver.isAboveReference ? (
                          <div className="text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                            <CheckCircle className="w-4 h-4" />
                            <span>✅ ACIMA DA REFERÊNCIA</span>
                          </div>
                        ) : targetOver.foundOdd !== null ? (
                          <div className="text-amber-400 font-semibold flex items-center justify-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Abaixo da odd de referência</span>
                          </div>
                        ) : (
                          <div className="text-slate-400">Odd de mercado não cotada no momento</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ================================================================= */}
                  {/* 6. PRESSÃO RECENTE (ODDCERTA - Item 6) */}
                  {/* ================================================================= */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-sky-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">
                          🔥 PRESSÃO RECENTE
                        </h3>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans">
                        5' • 10' • 15' minutos
                      </span>
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          title: 'ÚLTIMOS 15 MIN',
                          min: 15 as const,
                          intensity: intensity15,
                          xg: r15.xg,
                          rHome: recent15Home,
                          rAway: recent15Away,
                        },
                        {
                          title: 'ÚLTIMOS 10 MIN',
                          min: 10 as const,
                          intensity: intensity10,
                          xg: r10.xg,
                          rHome: recent10Home,
                          rAway: recent10Away,
                        },
                        {
                          title: 'ÚLTIMOS 5 MIN',
                          min: 5 as const,
                          intensity: intensity5,
                          xg: r5.xg,
                          rHome: recent5Home,
                          rAway: recent5Away,
                        },
                      ].map((win, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-slate-900 border border-slate-850 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white font-sans">
                              {win.title}
                            </span>
                            {/* Regra Item 6: Se MEGA HOT, mostrar apenas MEGA HOT */}
                            {win.intensity === 'MEGA_HOT' ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 font-mono">
                                <Flame className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                                🔥🔥 MEGA HOT
                              </span>
                            ) : win.intensity === 'HOT' ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-mono">
                                <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                HOT
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-sans">NORMAL</span>
                            )}
                          </div>

                          <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[11px] pt-1">
                            <div className="p-1 rounded bg-slate-950 border border-slate-800">
                              <span className="text-[9px] text-slate-400 block font-sans">xG</span>
                              <span className="font-bold text-emerald-400">
                                {win.xg !== null ? `+${win.xg.toFixed(2)}` : '—'}
                              </span>
                            </div>
                            <div className="p-1 rounded bg-slate-950 border border-slate-800">
                              <span className="text-[9px] text-slate-400 block font-sans">Finaliz.</span>
                              <span className="font-semibold text-slate-200">
                                {(win.rHome?.totalShots ?? 0) + (win.rAway?.totalShots ?? 0)}
                              </span>
                            </div>
                            <div className="p-1 rounded bg-slate-950 border border-slate-800">
                              <span className="text-[9px] text-slate-400 block font-sans">No gol</span>
                              <span className="font-bold text-emerald-300">
                                {(win.rHome?.shotsOnTarget ?? 0) + (win.rAway?.shotsOnTarget ?? 0)}
                              </span>
                            </div>
                            <div className="p-1 rounded bg-slate-950 border border-slate-800">
                              <span className="text-[9px] text-slate-400 block font-sans">Na área</span>
                              <span className="font-semibold text-slate-200">
                                {(win.rHome?.shotsInsideBox ?? 0) + (win.rAway?.shotsInsideBox ?? 0)}
                              </span>
                            </div>
                            <div className="p-1 rounded bg-slate-950 border border-slate-800">
                              <span className="text-[9px] text-slate-400 block font-sans">Chances</span>
                              <span className="font-bold text-amber-400">
                                {(win.rHome?.bigChances ?? 0) + (win.rAway?.bigChances ?? 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ================================================================= */}
                  {/* 5. HISTÓRICO DA LINHA NESTE CAMPEONATO (Item 5) */}
                  {/* ================================================================= */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">
                          FREQUÊNCIA HISTÓRICA OVER {targetOver.targetLine}
                        </h3>
                      </div>
                      <button
                        onClick={() => setActiveTab('historico')}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-sans font-bold flex items-center gap-1 cursor-pointer"
                      >
                        Ver completo →
                      </button>
                    </div>

                    {currentHistory?.isAvailable ? (
                      <div className="space-y-2 text-xs font-mono">
                        {/* Mandante */}
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-850">
                          <div className="text-[11px] font-bold text-emerald-400 font-sans mb-1">
                            {homeTeam.name}
                          </div>
                          <div className="flex items-center justify-between text-slate-300 text-[11px]">
                            <span>
                              Geral:{' '}
                              <strong>
                                {currentHistory.home?.overTargetHits}/
                                {currentHistory.home?.totalGamesAnalyzed} (
                                {currentHistory.home?.overTargetRatePercent}%)
                              </strong>
                            </span>
                            <span>
                              Em casa:{' '}
                              <strong className="text-emerald-400">
                                {currentHistory.home?.venueOverHits}/
                                {currentHistory.home?.venueGamesAnalyzed} (
                                {currentHistory.home?.venueOverRatePercent ?? 0}%)
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Visitante */}
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-850">
                          <div className="text-[11px] font-bold text-sky-400 font-sans mb-1">
                            {awayTeam.name}
                          </div>
                          <div className="flex items-center justify-between text-slate-300 text-[11px]">
                            <span>
                              Geral:{' '}
                              <strong>
                                {currentHistory.away?.overTargetHits}/
                                {currentHistory.away?.totalGamesAnalyzed} (
                                {currentHistory.away?.overTargetRatePercent}%)
                              </strong>
                            </span>
                            <span>
                              Fora:{' '}
                              <strong className="text-sky-400">
                                {currentHistory.away?.venueOverHits}/
                                {currentHistory.away?.venueGamesAnalyzed} (
                                {currentHistory.away?.venueOverRatePercent ?? 0}%)
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Estimativa do Cenário */}
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-amber-300 uppercase font-bold block font-sans">
                              ESTIMATIVA DO CENÁRIO:
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans">
                              Amostra: {currentHistory.sampleSizeTotalGames} jogos (mesmo campeonato)
                            </span>
                          </div>
                          <span className="text-2xl font-black text-amber-400">
                            {currentHistory.historicalEstimatePercent !== null
                              ? `${currentHistory.historicalEstimatePercent}%`
                              : 'N/D'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-slate-900/60 text-center text-xs text-slate-400 font-sans">
                        Calculando histórico nesta competição...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* ABA 2: RESUMO EXECUTIVO (Item 2)                                       */}
          {/* ======================================================================= */}
          {activeTab === 'resumo' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Cartão 1: Mercado Alvo Live */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase font-sans">
                      MERCADO MONITORADO
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono">
                      {tabNameHuman}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                      OVER {targetOver.targetLine}
                    </div>
                    {/* Odd com super destaque */}
                    <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 border border-emerald-400 font-mono shadow-md">
                      <span className="text-[10px] font-black uppercase text-slate-950/70 font-sans">
                        ODD
                      </span>
                      <span className="text-base sm:text-lg font-black tracking-tight text-slate-950">
                        {targetOver.foundOdd ? targetOver.foundOdd.toFixed(2) : '1.80'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300 font-mono pt-1.5 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400 font-sans">
                      {tabRuleHuman}
                    </span>
                    <span className="text-[9px] font-sans font-bold text-emerald-300/90 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md whitespace-nowrap">
                      Fonte: {targetOver.providerName || 'DraftKings'}
                    </span>
                  </div>
                </div>

                {/* Cartão 2: Pressão Geral da Partida */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase font-sans">
                      INTENSIDADE RECENTE
                    </span>
                    <Flame className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black font-mono">
                    {intensity.primaryTag === 'MEGA_HOT' ? (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <Flame className="w-6 h-6 fill-rose-500" />
                        MEGA HOT
                      </span>
                    ) : intensity.primaryTag === 'HOT' ? (
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <Flame className="w-6 h-6 fill-amber-500" />
                        HOT
                      </span>
                    ) : (
                      <span className="text-slate-400">NORMAL</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    xG 10m: <strong className="text-emerald-400">+{r10.xg?.toFixed(2) || '0.00'}</strong> • xG 5m: <strong className="text-emerald-400">+{r5.xg?.toFixed(2) || '0.00'}</strong>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans pt-1 border-t border-slate-800">
                    Calculado por delta de snapshots reais
                  </div>
                </div>

                {/* Cartão 3: Estimativa Histórica do Cenário */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase font-sans">
                      ESTIMATIVA HISTÓRICA
                    </span>
                    <Calendar className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    {currentHistory?.historicalEstimatePercent !== null && currentHistory?.historicalEstimatePercent !== undefined
                      ? `${currentHistory.historicalEstimatePercent}%`
                      : 'N/D'}
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    Amostra: <strong className="text-white">{currentHistory?.sampleSizeTotalGames || 0} jogos</strong> analisados
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans pt-1 border-t border-slate-800">
                    {competitionName}
                  </div>
                </div>
              </div>

              {/* Destaque das Métricas Chave */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">
                  COMPARAÇÃO RÁPIDA DE DESEMPENHO NO JOGO
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-850">
                    <span className="text-[10px] text-slate-400 block font-sans mb-1">xG Acumulado</span>
                    <span className="text-base font-bold text-emerald-400">
                      {fmt(homeStats?.xg, true)} × {fmt(awayStats?.xg, true)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-850">
                    <span className="text-[10px] text-slate-400 block font-sans mb-1">Finalizações no Alvo</span>
                    <span className="text-base font-bold text-white">
                      {fmt(homeStats?.shotsOnTarget)} × {fmt(awayStats?.shotsOnTarget)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-850">
                    <span className="text-[10px] text-slate-400 block font-sans mb-1">Grandes Chances</span>
                    <span className="text-base font-bold text-amber-400">
                      {fmt(homeStats?.bigChances)} × {fmt(awayStats?.bigChances)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-850">
                    <span className="text-[10px] text-slate-400 block font-sans mb-1">Posse de Bola</span>
                    <span className="text-base font-bold text-sky-400">
                      {homeStats?.possession ? `${homeStats.possession}%` : '—'} × {awayStats?.possession ? `${awayStats.possession}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* ABA 3: EVENTOS CRONOLÓGICOS (Item 13)                                  */}
          {/* ======================================================================= */}
          {activeTab === 'eventos' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">
                    LINHA DO TEMPO DA PARTIDA
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-sans">
                  Gols, cartões e substituições oficiais da transmissão
                </span>
              </div>

              {matchEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-sans text-xs space-y-2">
                  <div className="inline-flex p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-500 mb-1">
                    <Clock className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-300">Nenhum evento registrado ainda.</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Os gols, cartões e substituições reportados pela API pública da partida aparecerão aqui cronologicamente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 font-sans">
                  {matchEvents.map((evt, idx) => {
                    const isGoal = evt.type === 'goal';
                    const isRedCard = evt.type === 'red-card';
                    const isYellowCard = evt.type === 'yellow-card';
                    const isSub = evt.type === 'substitution';
                    const isPenalty = evt.type === 'penalty';
                    const isVar = evt.type === 'var';

                    return (
                      <div
                        key={evt.id || idx}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          isGoal
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : isRedCard
                            ? 'bg-rose-500/10 border-rose-500/30'
                            : isYellowCard
                            ? 'bg-amber-500/5 border-amber-500/20'
                            : 'bg-slate-900/80 border-slate-850'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Minuto */}
                          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 font-mono font-bold text-xs text-emerald-400 min-w-[42px] text-center shrink-0">
                            {evt.timeDisplay || `${evt.minute}'`}
                          </span>

                          {/* Ícone de Tipo */}
                          <span className="text-base shrink-0">
                            {isGoal
                              ? '⚽'
                              : isRedCard
                              ? '🟥'
                              : isYellowCard
                              ? '🟨'
                              : isSub
                              ? '🔄'
                              : isPenalty
                              ? '🥅'
                              : isVar
                              ? '📺'
                              : '⏱️'}
                          </span>

                          {/* Descrição */}
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-white truncate">
                              {evt.text}
                            </div>
                            {evt.teamName && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {evt.teamName}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tag do Time */}
                        {evt.isHome !== undefined && (
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${
                              evt.isHome
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                            }`}
                          >
                            {evt.isHome ? 'CASA' : 'FORA'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================================= */}
          {/* ABA 4: HISTÓRICO COMPLETO & AUDITORIA DE JOGOS (Itens 5, 7, 8, 9, 12)    */}
          {/* ======================================================================= */}
          {activeTab === 'historico' && (
            <div className="space-y-6">
              {/* Header com Seletor de Linhas de Over (Item 9) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2 font-sans">
                      <BarChart2 className="w-4 h-4 text-amber-400" />
                      HISTÓRICO NO MESMO CAMPEONATO ({competitionName})
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                      Somente jogos anteriores desta competição e temporada. Não mistura torneios.
                    </p>
                  </div>

                  {/* 9. SELETOR DE LINHA (Item 9) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 font-sans">
                      Linha analisada:
                    </span>
                    {[0.5, 1.5, 2.5, 3.5, 4.5].map((line) => {
                      const isTarget = line === targetOver.targetLine;
                      const isSelected = line === selectedLine;
                      return (
                        <button
                          key={line}
                          id={`btn-select-history-line-${line}`}
                          onClick={() => handleSelectLine(line)}
                          disabled={isLoadingHistory}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/25 border border-amber-500/60 text-amber-300 shadow-sm'
                              : isTarget
                              ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                          }`}
                        >
                          <span>OVER {line}</span>
                          {isTarget && (
                            <span className="ml-1 text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-sans">
                              Live
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isLoadingHistory ? (
                  <div className="p-8 text-center text-slate-400 font-sans text-xs">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent mb-2"></div>
                    <p>Recalculando histórico da linha Over {selectedLine}...</p>
                  </div>
                ) : !currentHistory?.isAvailable ? (
                  <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold font-sans">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>HISTÓRICO INDISPONÍVEL</span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans max-w-lg mx-auto">
                      {currentHistory?.statusMessage ||
                        'Sem jogos anteriores computados nesta competição.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* ESTIMATIVA DO CENÁRIO & FREQUÊNCIA (Item 5) */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-sans">
                            ESTIMATIVA HISTÓRICA DO CENÁRIO (OVER {selectedLine})
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase font-sans">
                            Amostra: {currentHistory.sampleSizeTotalGames} jogos
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans mt-1">
                          {currentHistory.methodologyDescription}
                        </p>
                      </div>

                      <div className="flex items-baseline gap-2 self-start sm:self-auto bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                        <span className="text-3xl font-black text-amber-400 font-mono">
                          {currentHistory.historicalEstimatePercent !== null
                            ? `${currentHistory.historicalEstimatePercent}%`
                            : 'N/D'}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold font-sans">
                          Estimativa
                        </span>
                      </div>
                    </div>

                    {/* Frequência Detalhada: Mandante × Visitante */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-emerald-400 font-sans">
                            {homeTeam.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 uppercase font-sans">
                            CASA
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-sans">Geral no campeonato:</span>
                          <span className="font-bold text-white">
                            {currentHistory.home?.overTargetHits}/
                            {currentHistory.home?.totalGamesAnalyzed}{' '}
                            <span className="text-emerald-400">
                              ({currentHistory.home?.overTargetRatePercent}%)
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-sans">Em casa:</span>
                          <span className="font-bold text-white">
                            {currentHistory.home?.venueGamesAnalyzed ? (
                              <>
                                {currentHistory.home?.venueOverHits}/
                                {currentHistory.home?.venueGamesAnalyzed}{' '}
                                <span className="text-emerald-400">
                                  ({currentHistory.home?.venueOverRatePercent}%)
                                </span>
                              </>
                            ) : (
                              'Sem jogos como mandante'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-sky-400 font-sans">{awayTeam.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 uppercase font-sans">
                            FORA
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-sans">Geral no campeonato:</span>
                          <span className="font-bold text-white">
                            {currentHistory.away?.overTargetHits}/
                            {currentHistory.away?.totalGamesAnalyzed}{' '}
                            <span className="text-sky-400">
                              ({currentHistory.away?.overTargetRatePercent}%)
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-sans">Fora:</span>
                          <span className="font-bold text-white">
                            {currentHistory.away?.venueGamesAnalyzed ? (
                              <>
                                {currentHistory.away?.venueOverHits}/
                                {currentHistory.away?.venueGamesAnalyzed}{' '}
                                <span className="text-sky-400">
                                  ({currentHistory.away?.venueOverRatePercent}%)
                                </span>
                              </>
                            ) : (
                              'Sem jogos como visitante'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ============================================================= */}
                    {/* 12. HISTÓRICO DE CADA TIME & AUDITORIA DE JOGOS (Item 12)    */}
                    {/* ============================================================= */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-sans flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-emerald-400" />
                            12. AUDITORIA DE JOGOS UTILIZADOS NO CÁLCULO
                          </h4>
                          <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                            Inspecione partida por partida para auditar de onde veio a porcentagem.
                          </p>
                        </div>

                        {/* Botões de Alternância de Time (Item 12) */}
                        <div className="flex items-center gap-2">
                          <button
                            id="btn-audit-home"
                            onClick={() => setAuditTeam('home')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                              auditTeam === 'home'
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {homeTeam.name} — {currentHistory.home?.overTargetHits}/
                            {currentHistory.home?.totalGamesAnalyzed}
                          </button>
                          <button
                            id="btn-audit-away"
                            onClick={() => setAuditTeam('away')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                              auditTeam === 'away'
                                ? 'bg-sky-500 text-slate-950 shadow-sm'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {awayTeam.name} — {currentHistory.away?.overTargetHits}/
                            {currentHistory.away?.totalGamesAnalyzed}
                          </button>
                        </div>
                      </div>

                      {/* Tabela de Jogos Auditáveis (Item 12) */}
                      {(() => {
                        const targetPerf =
                          auditTeam === 'home' ? currentHistory.home : currentHistory.away;
                        const auditList: TeamAuditMatchItem[] = targetPerf?.auditMatches || [];

                        if (auditList.length === 0) {
                          return (
                            <p className="text-center py-4 text-xs text-slate-400 font-sans">
                              Nenhuma partida anterior registrada para esta equipe nesta edição.
                            </p>
                          );
                        }

                        return (
                          <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-800 rounded-lg">
                            <table className="w-full text-xs font-mono">
                              <thead className="bg-slate-900 sticky top-0 text-slate-400 uppercase text-[10px]">
                                <tr className="border-b border-slate-800">
                                  <th className="text-left py-2 px-3 font-sans">Data</th>
                                  <th className="text-left py-2 px-3 font-sans">Partida</th>
                                  <th className="text-center py-2 px-3 font-sans">Mando</th>
                                  <th className="text-center py-2 px-3 font-sans">Placar</th>
                                  <th className="text-center py-2 px-3 font-sans">Total Gols</th>
                                  <th className="text-center py-2 px-3 font-sans">
                                    Over {selectedLine}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {auditList.map((item, i) => (
                                  <tr
                                    key={item.matchId || i}
                                    className="hover:bg-slate-900/50 transition-colors"
                                  >
                                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                                      {item.date}
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-white font-sans">
                                      {item.isHome
                                        ? `${targetPerf?.teamName} × ${item.opponentName}`
                                        : `${item.opponentName} × ${targetPerf?.teamName}`}
                                    </td>
                                    <td className="text-center py-2 px-3 text-[10px]">
                                      <span
                                        className={`px-1.5 py-0.5 rounded border font-sans ${
                                          item.isHome
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                            : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                                        }`}
                                      >
                                        {item.isHome ? 'CASA' : 'FORA'}
                                      </span>
                                    </td>
                                    <td className="text-center py-2 px-3 font-bold text-white">
                                      {item.teamScore} × {item.opponentScore}
                                    </td>
                                    <td className="text-center py-2 px-3 text-slate-300 font-semibold">
                                      {item.totalGoals} {item.totalGoals === 1 ? 'gol' : 'gols'}
                                    </td>
                                    <td className="text-center py-2 px-3">
                                      {item.isOverTarget ? (
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[11px]">
                                          OVER {selectedLine} ✓
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium text-[11px]">
                                          OVER {selectedLine} ✕
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>

                    {/* ============================================================= */}
                    {/* 7. DISTRIBUIÇÃO DE GOLS (Item 7)                             */}
                    {/* ============================================================= */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-white uppercase font-sans">
                          7. DISTRIBUIÇÃO DE GOLS NESTE CAMPEONATO
                        </span>
                        <div className="flex items-center gap-3 text-[10px] font-sans">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                            {homeTeam.name}
                          </span>
                          <span className="flex items-center gap-1 text-sky-400">
                            <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                            {awayTeam.name}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {[
                          { label: '0 gols', key: 'goals0' as const },
                          { label: '1 gol', key: 'goals1' as const },
                          { label: '2 gols', key: 'goals2' as const },
                          { label: '3 gols', key: 'goals3' as const },
                          { label: '4 gols', key: 'goals4' as const },
                          { label: '5+ gols', key: 'goals5Plus' as const },
                        ].map((row) => {
                          const hTotal = currentHistory.home?.totalGamesAnalyzed || 1;
                          const aTotal = currentHistory.away?.totalGamesAnalyzed || 1;
                          const hCount = currentHistory.home?.goalDistribution[row.key] || 0;
                          const aCount = currentHistory.away?.goalDistribution[row.key] || 0;
                          const hPct = Math.round((hCount / hTotal) * 100);
                          const aPct = Math.round((aCount / aTotal) * 100);

                          return (
                            <div
                              key={row.key}
                              className="grid grid-cols-[65px_1fr_75px] items-center gap-2 text-xs font-mono"
                            >
                              <span className="text-slate-400 text-[11px] font-sans">
                                {row.label}
                              </span>
                              <div className="flex items-center gap-1 h-3.5 bg-slate-950 rounded overflow-hidden p-0.5 border border-slate-800">
                                <div
                                  style={{ width: `${hPct}%` }}
                                  className="h-full bg-emerald-500 rounded-sm min-w-[2px]"
                                  title={`${homeTeam.name}: ${hCount} jogos (${hPct}%)`}
                                />
                                <div
                                  style={{ width: `${aPct}%` }}
                                  className="h-full bg-sky-500 rounded-sm min-w-[2px]"
                                  title={`${awayTeam.name}: ${aCount} jogos (${aPct}%)`}
                                />
                              </div>
                              <div className="flex items-center justify-end gap-1.5 text-[10px]">
                                <span className="text-emerald-400 font-bold">{hCount}j</span>
                                <span className="text-slate-600">/</span>
                                <span className="text-sky-400 font-bold">{aCount}j</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ============================================================= */}
                    {/* 8. COMPARAÇÃO DE LINHAS DE OVER (Item 8)                      */}
                    {/* ============================================================= */}
                    <div className="overflow-x-auto border border-slate-800 rounded-lg">
                      <table className="w-full text-xs font-mono">
                        <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                          <tr className="border-b border-slate-800">
                            <th className="text-left py-2 px-3 font-sans">Linha</th>
                            <th className="text-center py-2 px-3 font-sans text-emerald-400">
                              {homeTeam.name}
                            </th>
                            <th className="text-center py-2 px-3 font-sans text-sky-400">
                              {awayTeam.name}
                            </th>
                            <th className="text-center py-2 px-3 font-sans text-amber-300">
                              Média Combinada
                            </th>
                            <th className="text-center py-2 px-3 font-sans">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {[0.5, 1.5, 2.5, 3.5, 4.5].map((line) => {
                            const hItem = currentHistory.home?.ratesByLine.find(
                              (r) => r.line === line
                            );
                            const aItem = currentHistory.away?.ratesByLine.find(
                              (r) => r.line === line
                            );
                            const hPct = hItem?.ratePercent ?? 0;
                            const aPct = aItem?.ratePercent ?? 0;
                            const avgPct = parseFloat(((hPct + aPct) / 2).toFixed(1));
                            const isLiveTarget = line === targetOver.targetLine;
                            const isSelected = line === selectedLine;

                            return (
                              <tr
                                key={line}
                                onClick={() => handleSelectLine(line)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-amber-500/10'
                                    : isLiveTarget
                                    ? 'bg-emerald-500/5'
                                    : 'hover:bg-slate-900/40'
                                }`}
                              >
                                <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                                  <span>Over {line}</span>
                                  {isLiveTarget && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase font-sans">
                                      Monitorada
                                    </span>
                                  )}
                                </td>
                                <td className="text-center py-2.5 px-3 text-emerald-400">
                                  {hItem ? `${hItem.hits}/${hItem.total} (${hPct}%)` : '—'}
                                </td>
                                <td className="text-center py-2.5 px-3 text-sky-400">
                                  {aItem ? `${aItem.hits}/${aItem.total} (${aPct}%)` : '—'}
                                </td>
                                <td className="text-center py-2.5 px-3 font-bold text-amber-300">
                                  {avgPct}%
                                </td>
                                <td className="text-center py-2.5 px-3 text-[10px] font-sans">
                                  {isSelected ? (
                                    <span className="text-amber-300 font-bold">Selecionada</span>
                                  ) : (
                                    <span className="text-slate-400 hover:text-white">
                                      Clique p/ calcular
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            ODDCERTA MATCH CENTER • Dados ao vivo de fontes oficiais públicas
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <button
              id="btn-close-bottom"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold text-xs font-sans cursor-pointer transition-colors"
            >
              Voltar ao Monitor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
