import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { Flame, Shield } from 'lucide-react';
import { LiveMatchData, MatchRecentStats, TabType } from '../types.ts';
import { MatchTimeline15m } from './MatchTimeline15m.tsx';

interface MatchCardProps {
  match: LiveMatchData;
  currentTab?: TabType;
  onOpenDetailModal?: (match: LiveMatchData) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onOpenDetailModal }) => {
  const [justUpdated, setJustUpdated] = useState(false);
  const isFirstRender = useRef(true);

  // Efeito de pulso rápido na atualização dos dados em tempo real
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

  // Formatador seguro de exibição
  const fmt = (val: number | null | undefined, isXg = false): string => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return isXg ? val.toFixed(2) : String(val);
  };

  // Cálculo proporcional para as mini-barras comparativas
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

  // Detecção de Intervalo
  const isHalftime =
    displayClock?.toUpperCase().includes('HT') ||
    displayClock?.toUpperCase().includes('HALFTIME') ||
    displayClock?.toUpperCase().includes('INTERVALO');

  // Detecção do minuto do último gol da partida
  const lastGoalNotice = useMemo(() => {
    const totalGoals = (homeScore ?? 0) + (awayScore ?? 0);
    if (totalGoals === 0) return null;

    const goalEvents = (match.events || []).filter(
      (e) =>
        e.type === 'goal' ||
        e.shortText?.toLowerCase().includes('goal') ||
        e.text?.toLowerCase().includes('goal')
    );

    if (goalEvents.length > 0) {
      const latest = goalEvents.reduce(
        (max, g) => (!max || g.minute > max.minute ? g : max),
        goalEvents[0]
      );
      if (latest) {
        const minDisplay = latest.timeDisplay ? latest.timeDisplay.trim() : `${latest.minute}'`;
        const cleanMin = minDisplay.endsWith("'") ? minDisplay : `${minDisplay}'`;
        return `Último gol aos ${cleanMin}`;
      }
    }

    if (snapshots && snapshots.length >= 2) {
      const sortedSnaps = [...snapshots].sort((a, b) => a.minute - b.minute);
      for (let i = sortedSnaps.length - 1; i > 0; i--) {
        const prev = sortedSnaps[i - 1];
        const curr = sortedSnaps[i];
        if (curr.homeScore + curr.awayScore > prev.homeScore + prev.awayScore) {
          return `Último gol aos ${curr.minute}'`;
        }
      }
    }

    return null;
  }, [homeScore, awayScore, match.events, snapshots]);

  // Linhas comparativas de Expected Goals (xG Total, 15', 10', 5')
  const xgBreakdownRows = useMemo(() => {
    const totalGameHome = homeStats?.xg ?? 0;
    const totalGameAway = awayStats?.xg ?? 0;
    const totalGame = totalGameHome + totalGameAway;

    const getWindowXg = (windowMinutes: 15 | 10 | 5) => {
      const teamHome = windowMinutes === 15 ? recent15Home : windowMinutes === 10 ? recent10Home : recent5Home;
      const teamAway = windowMinutes === 15 ? recent15Away : windowMinutes === 10 ? recent10Away : recent5Away;
      const totalRec = windowMinutes === 15 ? r15 : windowMinutes === 10 ? r10 : r5;

      if (teamHome?.xg !== undefined && teamAway?.xg !== undefined) {
        const h = teamHome.xg || 0;
        const a = teamAway.xg || 0;
        return { home: h, away: a, total: parseFloat((h + a).toFixed(2)) };
      }

      if (snapshots && snapshots.length >= 2) {
        const sorted = [...snapshots].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const currentSnap = sorted[sorted.length - 1];
        const fromMinute = Math.max(0, minute - windowMinutes);
        const priorSnaps = sorted.filter((s) => s.minute <= fromMinute);
        const pastSnap = priorSnaps.length > 0 ? priorSnaps[priorSnaps.length - 1] : sorted[0];

        if (pastSnap && currentSnap && pastSnap !== currentSnap) {
          if (currentSnap.homeXg !== null && pastSnap.homeXg !== null) {
            const h = Math.max(0, parseFloat((currentSnap.homeXg - pastSnap.homeXg).toFixed(2)));
            const a =
              currentSnap.awayXg !== null && pastSnap.awayXg !== null
                ? Math.max(0, parseFloat((currentSnap.awayXg - pastSnap.awayXg).toFixed(2)))
                : 0;
            return { home: h, away: a, total: parseFloat((h + a).toFixed(2)) };
          }
        }
      }

      const tot = totalRec.xg || 0;
      const totalCombined = (homeStats?.xg ?? 0) + (awayStats?.xg ?? 0);
      if (totalCombined > 0) {
        const h = parseFloat((((homeStats?.xg ?? 0) / totalCombined) * tot).toFixed(2));
        const a = parseFloat((((awayStats?.xg ?? 0) / totalCombined) * tot).toFixed(2));
        return { home: h, away: a, total: tot };
      }

      return { home: parseFloat((tot / 2).toFixed(2)), away: parseFloat((tot / 2).toFixed(2)), total: tot };
    };

    const w15 = getWindowXg(15);
    const w10 = getWindowXg(10);
    const w5 = getWindowXg(5);

    return [
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

  return (
    <motion.div
      id={`match-card-${match.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative bg-slate-900 border border-slate-800 hover:border-slate-750 rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all font-mono text-slate-200 flex flex-col justify-between"
    >
      {/* Indicador de pulso em tempo real na borda */}
      {justUpdated && (
        <motion.div
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0 border-2 border-emerald-400/60 rounded-2xl sm:rounded-3xl pointer-events-none z-30 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        />
      )}

      <div>
        {/* CABEÇALHO DO CARD: CAMPEONATO + MINUTO + INTENSIDADE */}
        <div
          onClick={() => onOpenDetailModal?.(match)}
          className="px-2 py-1.5 sm:px-4 sm:py-3 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 rounded-t-xl sm:rounded-t-3xl cursor-pointer hover:bg-slate-950 transition-colors"
          title="Clique para abrir detalhes completos da partida"
        >
          <div className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[70px] sm:max-w-[240px]">
            {competitionName || 'CAMPEONATO'}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* AO VIVO / MINUTO */}
            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-black">
              {isHalftime ? (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] sm:text-[10px]">
                  INT
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-mono">{displayClock || `${minute}'`}</span>
                </span>
              )}
            </div>

            {/* TAG DE INTENSIDADE COM DISTINÇÃO PRÉ-GOL VS PÓS-GOL */}
            {intensity.primaryTag === 'MEGA_HOT' ? (
              <span
                className={`inline-flex items-center gap-1 text-[8px] sm:text-[11px] font-black px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${
                  intensity.hasRecentGoal
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60 shadow-sm'
                    : 'bg-rose-600 text-white shadow-sm shadow-rose-900/50 animate-pulse'
                }`}
                title={
                  intensity.hasRecentGoal
                    ? `Mega Hot Pós-Gol: Gol aos ${intensity.recentGoalMinute || '?'}' inflou o xG recente. Jogo pode desacelerar.`
                    : 'Mega Hot Pré-Gol: Pressão contínua sem gol recente!'
                }
              >
                <Flame className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${intensity.hasRecentGoal ? 'text-rose-400' : 'fill-white'}`} />
                <span className="hidden sm:inline">{intensity.hasRecentGoal ? 'MEGA (PÓS-GOL)' : 'MEGA HOT'}</span>
                <span className="sm:hidden">{intensity.hasRecentGoal ? 'PÓS-GOL' : 'MEGA'}</span>
                {!intensity.hasRecentGoal && <span className="text-[9px]">🎯</span>}
              </span>
            ) : intensity.primaryTag === 'HOT' ? (
              <span
                className={`inline-flex items-center gap-1 text-[8px] sm:text-[11px] font-black px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${
                  intensity.hasRecentGoal
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60 shadow-sm'
                    : 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-900/40'
                }`}
                title={
                  intensity.hasRecentGoal
                    ? `Hot Pós-Gol: Gol aos ${intensity.recentGoalMinute || '?'}' no intervalo recente.`
                    : 'Hot Pré-Gol: Pressão ativa sem gol recente!'
                }
              >
                <Flame className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${intensity.hasRecentGoal ? 'text-amber-400' : 'fill-slate-950'}`} />
                <span>{intensity.hasRecentGoal ? 'HOT (PÓS-GOL)' : 'HOT'}</span>
                {!intensity.hasRecentGoal && <span className="text-[9px]">🎯</span>}
              </span>
            ) : null}
          </div>
        </div>

        {/* BLOCO UNIFICADO: PLACAR + EXPECTED GOALS (xG) + TIMELINE 15' */}
        <div className="mx-1.5 sm:mx-3 my-1.5 sm:my-2.5 rounded-xl sm:rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-md overflow-hidden divide-y divide-slate-850">
          {/* SEÇÃO 1: PLACAR E CONFRONTO */}
          <div
            onClick={() => onOpenDetailModal?.(match)}
            className="p-2 sm:p-3 bg-slate-950/90 hover:bg-slate-900/70 transition-colors cursor-pointer"
            title="Clique para abrir estatísticas completas"
          >
            {/* 1A. VERSÃO MOBILE (2 LINHAS: MANDANTE EM CIMA, VISITANTE EMBAIXO - NUNCA SOBREPÕE) */}
            <div className="sm:hidden flex flex-col gap-1.5">
              {/* Linha Mandante */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="w-5 h-5 rounded bg-slate-900 border border-slate-750 flex items-center justify-center p-0.5 shrink-0 shadow-inner">
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
                      <Shield className="w-3 h-3 text-emerald-400/70" />
                    )}
                  </div>
                  <span
                    className="text-[11px] font-bold text-white truncate font-sans tracking-tight"
                    title={homeTeam?.name}
                  >
                    {homeTeam?.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-xs text-white bg-slate-850 px-1.5 py-0.5 rounded border border-slate-700 min-w-[20px] text-center shrink-0">
                  {homeScore ?? 0}
                </span>
              </div>

              {/* Linha Visitante */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="w-5 h-5 rounded bg-slate-900 border border-slate-750 flex items-center justify-center p-0.5 shrink-0 shadow-inner">
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
                      <Shield className="w-3 h-3 text-sky-400/70" />
                    )}
                  </div>
                  <span
                    className="text-[11px] font-bold text-white truncate font-sans tracking-tight"
                    title={awayTeam?.name}
                  >
                    {awayTeam?.name}
                  </span>
                </div>
                <span className="font-mono font-bold text-xs text-white bg-slate-850 px-1.5 py-0.5 rounded border border-slate-700 min-w-[20px] text-center shrink-0">
                  {awayScore ?? 0}
                </span>
              </div>

              {/* Aviso de Último Gol (se houver) */}
              {lastGoalNotice && (
                <div className="pt-0.5 text-center">
                  <span className="text-[8px] font-bold text-rose-400 font-mono tracking-tight block truncate">
                    {lastGoalNotice}
                  </span>
                </div>
              )}
            </div>

            {/* 1B. VERSÃO DESKTOP / TABLET (HORIZONTAL DE 3 COLUNAS) */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
              {/* Mandante (Esquerda) */}
              <div className="flex items-center gap-2.5 min-w-0">
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
                    className="text-sm font-bold text-white truncate block font-sans tracking-tight"
                    title={homeTeam?.name}
                  >
                    {homeTeam?.name}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 font-sans block mt-0.5">
                    MANDANTE
                  </span>
                </div>
              </div>

              {/* Placar Central com Tempo & Aviso de Último Gol */}
              <div className="flex flex-col items-center justify-center px-1 text-center min-w-[105px]">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="px-2.5 py-0.5 rounded-xl bg-slate-850 border border-slate-700 text-base font-bold text-white min-w-[32px] text-center shadow-inner">
                    {homeScore ?? 0}
                  </span>
                  <span className="text-slate-500 font-black text-xs">x</span>
                  <span className="px-2.5 py-0.5 rounded-xl bg-slate-850 border border-slate-700 text-base font-bold text-white min-w-[32px] text-center shadow-inner">
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
              <div className="flex items-center justify-end gap-2.5 min-w-0 text-right">
                <div className="min-w-0 flex-1">
                  <span
                    className="text-sm font-bold text-white truncate block font-sans tracking-tight"
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

          {/* SEÇÃO 2: EXPECTED GOALS (xG RECENTE) */}
          <div className="p-1.5 sm:p-3 bg-slate-950/60">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[8px] sm:text-[10px] font-bold uppercase tracking-wider pb-1 mb-1 sm:pb-1.5 sm:mb-1.5 border-b border-slate-850 text-slate-400">
              <div className="flex items-center gap-1 min-w-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="text-emerald-400 truncate font-sans font-semibold text-[8px] sm:text-[10px]">
                  {homeTeam?.name || 'MANDANTE'}
                </span>
              </div>
              <span className="px-1 text-center text-slate-300 font-bold font-sans text-[8px] sm:text-[10px] whitespace-nowrap">
                <span className="hidden sm:inline">PRESSÃO RECENTE </span>
                <span>xG</span>
              </span>
              <div className="flex items-center justify-end gap-1 min-w-0">
                <span className="text-sky-400 truncate font-sans font-semibold text-[8px] sm:text-[10px]">
                  {awayTeam?.name || 'VISITANTE'}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0"></span>
              </div>
            </div>

            <div className="space-y-1">
              {xgBreakdownRows.map((row) => {
                const homeWins = (row.home ?? 0) > (row.away ?? 0);
                const awayWins = (row.away ?? 0) > (row.home ?? 0);

                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-1 sm:gap-2 py-0.5 sm:py-1 px-1 sm:px-2 rounded-lg sm:rounded-xl bg-slate-900/60 border border-slate-850"
                  >
                    {/* Mandante */}
                    <div className="flex items-center gap-1 justify-start shrink-0">
                      <span
                        className={`font-mono font-bold text-[9px] sm:text-[11px] px-1 sm:px-2 py-0.5 rounded border min-w-[28px] sm:min-w-[38px] text-center ${
                          homeWins
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-850 border-slate-750 text-emerald-400'
                        }`}
                      >
                        {row.isCumulative ? fmt(row.home, true) : `+${fmt(row.home, true)}`}
                      </span>
                    </div>

                    {/* Nome da Métrica */}
                    <div className="text-center font-mono text-[8px] sm:text-[10px] font-bold text-slate-300 uppercase tracking-wide px-0.5 whitespace-nowrap truncate">
                      <span className="hidden sm:inline">{row.label}: </span>
                      <span className="sm:hidden">{row.id}': </span>
                      <strong className="text-emerald-400">
                        {row.isCumulative ? row.total.toFixed(2) : `+${row.total.toFixed(2)}`}
                      </strong>
                    </div>

                    {/* Visitante */}
                    <div className="flex items-center gap-1 justify-end shrink-0">
                      <span
                        className={`font-mono font-bold text-[9px] sm:text-[11px] px-1 sm:px-2 py-0.5 rounded border min-w-[28px] sm:min-w-[38px] text-center ${
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

          {/* SEÇÃO 3: TIMELINE 15' */}
          <MatchTimeline15m
            minute={minute}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            timeline15m={match.timeline15m}
            recent15={recent15}
            recent15Home={recent15Home}
            recent15Away={recent15Away}
            embedded={true}
          />
        </div>

        {/* LINHA 4 — MERCADO ALVO OVER & ODD AO VIVO */}
        <div className="mx-1.5 sm:mx-3 mb-1.5 sm:mb-3 px-1.5 sm:px-3 py-1 sm:py-2 rounded-lg sm:rounded-2xl bg-slate-950/85 border border-slate-800/90 flex items-center justify-between gap-1 font-mono shadow-sm">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[8px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans whitespace-nowrap hidden xs:inline">
              Alvo:
            </span>
            <span className="text-[9px] sm:text-sm font-black text-white bg-emerald-500/15 border border-emerald-500/30 px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg whitespace-nowrap">
              OVER {targetOver.targetLine}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span
              className="text-[9px] font-sans font-medium text-slate-400 hidden md:inline whitespace-nowrap truncate max-w-[130px]"
              title="Casa de apostas / Provedor"
            >
              Fonte: {targetOver.providerName || 'DraftKings'}
            </span>
            <div className="flex items-center gap-1 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-emerald-500 text-slate-950 border border-emerald-400 shadow-sm">
              <span className="text-[7px] sm:text-[9px] font-black uppercase text-slate-950/70 font-sans">
                ODD
              </span>
              <span className="text-[11px] sm:text-base font-black tracking-tight text-slate-950">
                {targetOver.foundOdd ? targetOver.foundOdd.toFixed(2) : '1.80'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
