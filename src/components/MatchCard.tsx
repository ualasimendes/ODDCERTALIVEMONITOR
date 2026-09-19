import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, ChevronDown, ChevronUp, ExternalLink, Flame, Info, Shield, Target } from 'lucide-react';
import { LiveMatchData, MatchRecentStats } from '../types.ts';

interface MatchCardProps {
  match: LiveMatchData;
  onOpenDetailModal: (match: LiveMatchData) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onOpenDetailModal }) => {
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Safe display formatter: STRICT ZERO MOCK — if null or undefined, outputs 'N/D'
  const fmt = (val: number | null | undefined, isXg = false): string => {
    if (val === null || val === undefined || isNaN(val)) return 'N/D';
    return isXg ? val.toFixed(2) : String(val);
  };

  // Helper for subtle comparison bar proportions (Flashscore style)
  const getProportions = (val1: number | null | undefined, val2: number | null | undefined) => {
    const v1 = (val1 !== null && val1 !== undefined && !isNaN(val1)) ? Number(val1) : 0;
    const v2 = (val2 !== null && val2 !== undefined && !isNaN(val2)) ? Number(val2) : 0;
    const total = v1 + v2;
    if (total <= 0) return { p1: 50, p2: 50, hasData: false };
    return {
      p1: Math.max(10, Math.min(90, Math.round((v1 / total) * 100))),
      p2: Math.max(10, Math.min(90, Math.round((v2 / total) * 100))),
      hasData: true,
    };
  };

  // Halftime detection
  const isHalftime =
    displayClock?.toUpperCase().includes('HT') ||
    displayClock?.toUpperCase().includes('HALFTIME') ||
    displayClock?.toUpperCase().includes('INTERVALO');

  return (
    <motion.div
      id={`match-card-${match.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-md transition-all font-mono text-slate-200"
    >
      {/* Real-time update highlight pulse */}
      {justUpdated && (
        <motion.div
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0 border-2 border-emerald-400/60 rounded-2xl pointer-events-none z-30 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        />
      )}

      {/* LINHA 1 — CABEÇALHO DO JOGO */}
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/80">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[200px] sm:max-w-[260px]">
          {competitionName || 'CAMPEONATO'}
        </div>

        <div className="flex items-center gap-2">
          {/* AO VIVO / MINUTO */}
          <div className="flex items-center gap-1.5 text-xs font-black">
            {isHalftime ? (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                INT
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>AO VIVO {displayClock || `${minute}'`}</span>
              </span>
            )}
          </div>

          {/* TAG DE INTENSIDADE */}
          {intensity.primaryTag === 'MEGA_HOT' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded bg-rose-600 text-white shadow-sm shadow-rose-900/50 uppercase tracking-wider animate-pulse">
              <Flame className="w-3 h-3 fill-white" />
              MEGA HOT
            </span>
          ) : intensity.primaryTag === 'HOT' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded bg-amber-500 text-slate-950 shadow-sm shadow-amber-900/40 uppercase tracking-wider">
              <Flame className="w-3 h-3 fill-slate-950" />
              HOT
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 uppercase font-bold">
              NORMAL
            </span>
          )}
        </div>
      </div>

      {/* LINHA 2 — TIMES ALINHADOS PARALELAMENTE (COM CARDS, BORDAS E MARGENS) */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800/80">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          {/* Card Paralelo Mandante (CASA) */}
          <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2 min-w-0 shadow-sm hover:border-slate-700 transition-colors">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  MANDANTE
                </span>
              </div>
              <span
                className="text-xs sm:text-sm font-bold text-white truncate block tracking-tight font-sans"
                title={homeTeam?.name}
              >
                {homeTeam?.name}
              </span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-slate-850 border border-slate-700 text-base sm:text-lg font-bold text-white min-w-[34px] text-center shadow-inner font-mono">
              {homeScore}
            </div>
          </div>

          {/* Placar Central & Mercado OVER */}
          <div className="flex flex-col items-center justify-center px-1 text-center min-w-[120px] sm:min-w-[140px]">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
              {homeScore} × {awayScore}
            </span>

            {/* Pill do Mercado Alvo */}
            <div className="w-full px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center shadow-sm">
              <div className="text-[11px] sm:text-xs font-bold text-emerald-400 whitespace-nowrap font-mono">
                OVER {targetOver.targetLine} @ {targetOver.foundOdd ? targetOver.foundOdd.toFixed(2) : 'N/D'}
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                {targetOver.isAboveReference && (
                  <span className="text-[8px] font-bold text-emerald-300 bg-emerald-500/25 px-1 rounded">
                    +REF
                  </span>
                )}
                <span className="text-[9px] text-slate-400 font-mono">
                  Ref: {targetOver.referenceOdd.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Card Paralelo Visitante (FORA) */}
          <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2 min-w-0 shadow-sm hover:border-slate-700 transition-colors">
            <div className="px-2.5 py-1 rounded-md bg-slate-850 border border-slate-700 text-base sm:text-lg font-bold text-white min-w-[34px] text-center shadow-inner order-2 sm:order-1 font-mono">
              {awayScore}
            </div>
            <div className="min-w-0 flex-1 text-right order-1 sm:order-2">
              <div className="flex items-center justify-end gap-1 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 whitespace-nowrap">
                  VISITANTE
                </span>
              </div>
              <span
                className="text-xs sm:text-sm font-bold text-white truncate block tracking-tight font-sans"
                title={awayTeam?.name}
              >
                {awayTeam?.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* LINHA 3 — ESTATÍSTICAS PRINCIPAIS ALINHADAS EM 3 COLUNAS PARALELAS COM MARGENS */}
      <div className="mx-3 my-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 shadow-inner">
        {/* Cabeçalho Paralelo das Estatísticas */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[10px] font-bold uppercase tracking-wider pb-2 mb-2 border-b border-slate-800/70 text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-emerald-400 truncate max-w-[90px] font-sans font-semibold">{homeTeam?.name || 'CASA'}</span>
          </div>
          <span className="px-2 text-center text-slate-300 font-bold font-sans">ESTATÍSTICAS DA PARTIDA</span>
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-sky-400 truncate max-w-[90px] font-sans font-semibold">{awayTeam?.name || 'FORA'}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
          </div>
        </div>

        {/* Linhas de Estatísticas Paralelas */}
        <div className="space-y-1.5 text-xs font-mono">
          {[
            {
              label: 'Expected Goals (xG)',
              homeVal: fmt(homeStats?.xg, true),
              awayVal: fmt(awayStats?.xg, true),
              rawHome: homeStats?.xg,
              rawAway: awayStats?.xg,
              isHighlight: true,
            },
            {
              label: 'Finalizações Totais',
              homeVal: fmt(homeStats?.totalShots),
              awayVal: fmt(awayStats?.totalShots),
              rawHome: homeStats?.totalShots,
              rawAway: awayStats?.totalShots,
            },
            {
              label: 'No Alvo',
              homeVal: fmt(homeStats?.shotsOnTarget),
              awayVal: fmt(awayStats?.shotsOnTarget),
              rawHome: homeStats?.shotsOnTarget,
              rawAway: awayStats?.shotsOnTarget,
              isTarget: true,
            },
            {
              label: 'Na Área',
              homeVal: fmt(homeStats?.shotsInsideBox),
              awayVal: fmt(awayStats?.shotsInsideBox),
              rawHome: homeStats?.shotsInsideBox,
              rawAway: awayStats?.shotsInsideBox,
            },
            {
              label: 'Grandes Chances',
              homeVal: fmt(homeStats?.bigChances),
              awayVal: fmt(awayStats?.bigChances),
              rawHome: homeStats?.bigChances,
              rawAway: awayStats?.bigChances,
              isAmber: true,
            },
          ].map((stat, i) => {
            const props = getProportions(stat.rawHome, stat.rawAway);
            const homeWins = (stat.rawHome ?? 0) > (stat.rawAway ?? 0);
            const awayWins = (stat.rawAway ?? 0) > (stat.rawHome ?? 0);

            return (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-850 hover:bg-slate-900/90 transition-colors"
              >
                {/* Lado Esquerdo: Valor Mandante + Mini Barra */}
                <div className="flex items-center gap-2 justify-start">
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded border min-w-[38px] text-center ${
                      homeWins
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : stat.isHighlight
                        ? 'bg-slate-800 border-slate-700 text-emerald-400'
                        : 'bg-slate-850 border-slate-750 text-slate-300'
                    }`}
                  >
                    {stat.homeVal}
                  </span>
                  {props.hasData && (
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden flex justify-end max-w-[60px] hidden sm:flex">
                      <div
                        className={`h-full rounded-full ${
                          homeWins ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                        style={{ width: `${props.p1}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Centro: Nome da Métrica */}
                <div className="text-center font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wide px-1.5 whitespace-nowrap">
                  {stat.label}
                </div>

                {/* Lado Direito: Mini Barra + Valor Visitante */}
                <div className="flex items-center gap-2 justify-end">
                  {props.hasData && (
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden flex justify-start max-w-[60px] hidden sm:flex">
                      <div
                        className={`h-full rounded-full ${
                          awayWins ? 'bg-sky-400' : 'bg-slate-500'
                        }`}
                        style={{ width: `${props.p2}%` }}
                      />
                    </div>
                  )}
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded border min-w-[38px] text-center ${
                      awayWins
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                        : stat.isHighlight
                        ? 'bg-slate-800 border-slate-700 text-sky-400'
                        : 'bg-slate-850 border-slate-750 text-slate-300'
                    }`}
                  >
                    {stat.awayVal}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LINHA 4 — SNAPSHOTS RECENTES NO CARD INICIAL */}
      <div className="mx-3 mb-2.5 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 shadow-sm">
        <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-sans">
              Snapshots da Partida
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-750">
              {snapshots && snapshots.length > 0 ? snapshots.length : 1}
            </span>
          </div>
          <span className="text-[9px] font-mono text-slate-400">
            {snapshots && snapshots.length > 1 ? 'Últimas leituras' : 'Leitura ao vivo'}
          </span>
        </div>

        {/* Lista de Snapshots no Card Inicial */}
        <div className="space-y-1 font-mono text-[10px]">
          {snapshots && snapshots.length > 0 ? (
            snapshots.slice(-3).reverse().map((snap, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between px-2.5 py-1 rounded-lg border transition-colors ${
                  idx === 0
                    ? 'bg-slate-900/95 border-emerald-500/40 text-slate-200'
                    : 'bg-slate-900/60 border-slate-800/60 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${idx === 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {snap.minute}'
                  </span>
                  <span className="text-slate-400 font-medium">
                    {snap.homeScore}×{snap.awayScore}
                  </span>
                  {idx === 0 && (
                    <span className="text-[8px] font-sans font-bold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                      Atual
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3">
                  <span className="text-emerald-400 font-semibold">
                    {snap.totalXg !== null && snap.totalXg !== undefined ? `${snap.totalXg.toFixed(2)} xG` : 'N/D'}
                  </span>
                  <span className="text-slate-300">
                    Fin: {(snap.homeShots ?? 0) + (snap.awayShots ?? 0)}
                  </span>
                  <span className="text-slate-400 hidden sm:inline">
                    No Gol: {(snap.homeShotsOnTarget ?? 0) + (snap.awayShotsOnTarget ?? 0)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-900/95 border border-emerald-500/40 text-[10px] text-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">{minute}'</span>
                <span className="text-slate-300 font-medium">{homeScore}×{awayScore}</span>
                <span className="text-[8px] font-sans font-bold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                  Atual
                </span>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="text-emerald-400 font-semibold">
                  {homeStats?.xg !== null && homeStats?.xg !== undefined && awayStats?.xg !== null && awayStats?.xg !== undefined
                    ? `${(homeStats.xg + awayStats.xg).toFixed(2)} xG`
                    : homeStats?.xg !== null && homeStats?.xg !== undefined
                    ? `${homeStats.xg.toFixed(2)} xG`
                    : 'N/D'}
                </span>
                <span className="text-slate-300">
                  Fin: {(homeStats?.totalShots ?? 0) + (awayStats?.totalShots ?? 0)}
                </span>
                <span className="text-slate-400 hidden sm:inline">
                  No Gol: {(homeStats?.shotsOnTarget ?? 0) + (awayStats?.shotsOnTarget ?? 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LINHA 4.5 — HISTÓRICO OVER ABERTO RESUMIDO */}
      <div className="mx-3 mb-2.5 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 shadow-sm">
        {/* Header com título e linha alvo */}
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-amber-400 font-bold text-xs" role="img" aria-label="Histórico">📊</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-200 uppercase tracking-wider font-sans whitespace-nowrap">
              Histórico Over {targetOver.targetLine}
            </span>
            {match.history?.isReducedSample && (
              <span className="text-[8px] sm:text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                Amostra curta
              </span>
            )}
          </div>

          <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 whitespace-nowrap">
            Probabilidades reais
          </span>
        </div>

        {/* 3 Blocos Lado a Lado: Mandante | Partida (Cenário) | Visitante */}
        {match.history?.isAvailable && match.history.home && match.history.away ? (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center font-mono">
            {/* 1. Mandante */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-400 uppercase truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="truncate">{homeTeam?.shortName || homeTeam?.abbreviation || 'CASA'}</span>
              </div>
              <div className="text-sm sm:text-base font-black text-emerald-300 my-0.5">
                {match.history.home.overTargetRatePercent}%
              </div>
              <div className="text-[9px] text-slate-400">
                {match.history.home.overTargetHits}/{match.history.home.totalGamesAnalyzed} jogos
              </div>
            </div>

            {/* 2. Partida / Cenário Ponderado */}
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-amber-300 uppercase tracking-tight truncate">
                Partida
              </div>
              <div className="text-base sm:text-lg font-black text-amber-300 my-0.5">
                {match.history.historicalEstimatePercent !== null
                  ? `${match.history.historicalEstimatePercent}%`
                  : 'N/D'}
              </div>
              <div className="text-[9px] text-amber-400/80">
                Estimativa
              </div>
            </div>

            {/* 3. Visitante */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-sky-400 uppercase truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0"></span>
                <span className="truncate">{awayTeam?.shortName || awayTeam?.abbreviation || 'FORA'}</span>
              </div>
              <div className="text-sm sm:text-base font-black text-sky-300 my-0.5">
                {match.history.away.overTargetRatePercent}%
              </div>
              <div className="text-[9px] text-slate-400">
                {match.history.away.overTargetHits}/{match.history.away.totalGamesAnalyzed} jogos
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-center text-[10px] font-mono text-slate-400">
            {match.history?.statusMessage || 'Histórico indisponível para esta competição na temporada.'}
          </div>
        )}
      </div>

      {/* ÁREA SANFONA (EXPANDIDA VIA [ ▼ DETALHES ]) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-slate-950 border-t border-slate-800/80"
          >
            <div className="p-3.5 space-y-3 text-xs">
              {/* Seção Estatísticas Complementares Paralelas com Margens */}
              <div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[10px] font-bold uppercase tracking-wider pb-1.5 mb-2 border-b border-slate-800/60 text-slate-400">
                  <span className="text-emerald-400">CASA</span>
                  <span className="text-center font-black text-slate-300">ESTATÍSTICAS COMPLEMENTARES</span>
                  <span className="text-right text-sky-400">FORA</span>
                </div>

                <div className="space-y-1.5">
                  {[
                    { label: 'Escanteios', home: fmt(homeStats?.corners), away: fmt(awayStats?.corners) },
                    {
                      label: 'Posse de Bola',
                      home: homeStats?.possession ? `${homeStats.possession}%` : 'N/D',
                      away: awayStats?.possession ? `${awayStats.possession}%` : 'N/D',
                    },
                    {
                      label: 'Passes Realizados',
                      home: fmt(homeStats?.passes),
                      away: fmt(awayStats?.passes),
                    },
                    {
                      label: 'Precisão Passes',
                      home: homeStats?.passAccuracy ? `${homeStats.passAccuracy}%` : 'N/D',
                      away: awayStats?.passAccuracy ? `${awayStats.passAccuracy}%` : 'N/D',
                    },
                    {
                      label: 'Ataques Totais',
                      home: fmt(homeStats?.attacks),
                      away: fmt(awayStats?.attacks),
                    },
                    {
                      label: 'Ataques Perigosos',
                      home: fmt(homeStats?.dangerousAttacks),
                      away: fmt(awayStats?.dangerousAttacks),
                      isHighlight: true,
                    },
                    {
                      label: 'Faltas',
                      home: fmt(homeStats?.fouls),
                      away: fmt(awayStats?.fouls),
                    },
                    {
                      label: 'Impedimentos',
                      home: fmt(homeStats?.offsides),
                      away: fmt(awayStats?.offsides),
                    },
                    {
                      label: 'Cartões Amarelos 🟨',
                      home: fmt(homeStats?.yellowCards ?? 0),
                      away: fmt(awayStats?.yellowCards ?? 0),
                      isAmber: true,
                    },
                    {
                      label: 'Cartões Vermelhos 🟥',
                      home: fmt(homeStats?.redCards ?? 0),
                      away: fmt(awayStats?.redCards ?? 0),
                      isRed: true,
                    },
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1 px-2.5 rounded-lg bg-slate-900/60 border border-slate-850"
                    >
                      <div className="flex items-center justify-start">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-850 border border-slate-750 text-slate-200 min-w-[34px] text-center">
                          {row.home}
                        </span>
                      </div>
                      <div className="text-center font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wide px-1">
                        {row.label}
                      </div>
                      <div className="flex items-center justify-end">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-850 border border-slate-750 text-slate-200 min-w-[34px] text-center">
                          {row.away}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Histórico de Snapshots Registrados */}
              {snapshots && snapshots.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1 pb-1 border-b border-slate-800/50">
                    HISTÓRICO RECENTE DE SNAPSHOTS ({snapshots.length})
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                    {snapshots.slice(-5).reverse().map((snap, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800/60"
                      >
                        <span className="text-white font-bold">{snap.minute}' | {snap.homeScore}×{snap.awayScore}</span>
                        <span className="text-emerald-400">xG: {snap.totalXg !== null ? snap.totalXg.toFixed(2) : 'N/D'}</span>
                        <span>Fin: {(snap.homeShots ?? 0) + (snap.awayShots ?? 0)}</span>
                        <span>No Gol: {(snap.homeShotsOnTarget ?? 0) + (snap.awayShotsOnTarget ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LINHA 5 — AÇÕES RÁPIDAS */}
      <div className="px-3.5 py-2.5 bg-slate-950 flex items-center justify-between gap-2 border-t border-slate-800/80">
        <button
          id={`btn-expand-${match.id}`}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 active:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold font-sans transition-all cursor-pointer"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              <span>Estatísticas</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Estatísticas</span>
            </>
          )}
        </button>

        <button
          id={`btn-popout-${match.id}`}
          onClick={() => onOpenDetailModal(match)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-sans transition-all cursor-pointer shadow-sm shadow-emerald-950/20"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Análise completa</span>
        </button>
      </div>
    </motion.div>
  );
};
