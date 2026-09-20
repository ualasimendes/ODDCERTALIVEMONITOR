import React, { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { MatchTimelineAction, TeamInfo, MatchRecentStats, TeamRecentStats } from '../types.ts';
import { formatTimelineAction } from '../utils/actionFormatter.ts';

interface MatchTimeline15mProps {
  minute: number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  timeline15m?: MatchTimelineAction[];
  recent15?: MatchRecentStats;
  recent15Home?: TeamRecentStats;
  recent15Away?: TeamRecentStats;
  embedded?: boolean;
}

export const MatchTimeline15m: React.FC<MatchTimeline15mProps> = ({
  minute,
  timeline15m = [],
  recent15,
  recent15Home,
  recent15Away,
  embedded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const windowStart = Math.max(0, minute - 15);
  const windowEnd = Math.max(0, minute);
  const span = Math.max(1, windowEnd - windowStart);

  // Filtrar ações estritamente nos últimos 15 minutos
  const actions = timeline15m.filter(
    (a) => a.minute >= windowStart && a.minute <= windowEnd
  );

  // Ordenar lances com o mais recente no topo (ordem cronológica decrescente)
  const sortedActions = [...actions].sort((a, b) => b.minute - a.minute);

  // Totais agregados com fallback caso a ESPN não traga texto de comentários
  const fallbackGoals = (recent15Home?.goals ?? 0) + (recent15Away?.goals ?? 0);
  const fallbackSot = (recent15Home?.shotsOnTarget ?? 0) + (recent15Away?.shotsOnTarget ?? 0);
  const fallbackInside = (recent15Home?.shotsInsideBox ?? 0) + (recent15Away?.shotsInsideBox ?? 0);
  const fallbackOff = (recent15Home?.shotsOffTarget ?? 0) + (recent15Away?.shotsOffTarget ?? 0);

  const goalsCount = actions.length > 0 ? actions.filter((a) => a.isGoal).length : fallbackGoals;
  const sotCount = actions.length > 0 ? actions.filter((a) => a.isOnTarget).length : fallbackSot;
  const insideBoxCount = actions.length > 0 ? actions.filter((a) => a.isInsideBox).length : fallbackInside;
  const offTargetCount = actions.length > 0 ? actions.filter((a) => a.isOffTarget).length : fallbackOff;

  const totalActionsXg = actions.reduce((sum, a) => sum + (a.xg || 0), 0);
  const totalXg = totalActionsXg > 0 ? totalActionsXg : (recent15?.xg ?? 0);

  const containerClasses = embedded
    ? 'p-2.5 sm:p-3 space-y-2 font-sans bg-slate-950/80'
    : 'mx-3 mb-2 p-2.5 sm:p-3 rounded-2xl bg-slate-950/85 border border-slate-800/90 shadow-sm space-y-2 font-sans';

  return (
    <div className={containerClasses}>
      {/* 1. Cabeçalho Compacto: Janela e 5 Métricas Chave (Apenas Números) */}
      <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-850/80 font-mono text-[9px] font-bold">
        <div className="flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-slate-300 whitespace-nowrap">
            {windowStart}'-{windowEnd}'
          </span>
        </div>

        {/* Resumo Rápido das 5 Métricas (Apenas números + ícones) */}
        <div className="flex items-center gap-1 text-[9px] font-mono font-bold flex-wrap justify-end">
          {goalsCount > 0 && (
            <span
              className="px-1.5 py-0.5 rounded border bg-rose-500/20 border-rose-500/40 text-rose-300 whitespace-nowrap"
              title="Gols na janela recente"
            >
              ⚽{goalsCount}
            </span>
          )}

          <span
            className={`px-1.5 py-0.5 rounded border whitespace-nowrap ${
              sotCount > 0
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Finalizações no gol"
          >
            🎯{sotCount}
          </span>

          <span
            className={`px-1.5 py-0.5 rounded border whitespace-nowrap ${
              insideBoxCount > 0
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Finalizações na área"
          >
            📦{insideBoxCount}
          </span>

          <span
            className="px-1.5 py-0.5 rounded border bg-slate-900 border-slate-800 text-slate-400 whitespace-nowrap"
            title="Finalizações para fora"
          >
            💨{offTargetCount}
          </span>

          <span
            className="px-1.5 py-0.5 rounded border bg-emerald-500/15 border-emerald-500/35 text-emerald-400 font-black whitespace-nowrap"
            title="Soma de xG recente"
          >
            {totalXg.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 2. Barra Visual da Linha do Tempo (Trilho dos 15 minutos) */}
      <div className="pt-0.5 px-0.5">
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 mb-1">
          <span>{windowStart}'</span>
          <span className="text-slate-500">intervalo recente</span>
          <span className="text-emerald-400 font-bold">{windowEnd}' (agora)</span>
        </div>

        <div className="relative h-2 bg-slate-900 border border-slate-800 rounded-full">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-850 rounded-full" />

          {/* Marcadores dos Lances na Linha do Tempo */}
          {actions.map((act) => {
            const rawPct = ((act.minute - windowStart) / span) * 100;
            const pct = Math.min(97, Math.max(3, rawPct));
            const isSelected = selectedActionId === act.id;

            return (
              <button
                key={act.id}
                type="button"
                onClick={() => setSelectedActionId(isSelected ? null : act.id)}
                title={`${act.timeDisplay} | ${act.player || act.teamName}: ${act.isGoal ? 'GOL' : act.isOnTarget ? 'No Alvo' : act.isInsideBox ? 'Na Área' : 'Pra Fora'} (+${act.xg.toFixed(2)} xG)`}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform cursor-pointer focus:outline-none ${
                  isSelected ? 'scale-150 z-20' : 'hover:scale-125 z-10'
                }`}
                style={{ left: `${pct}%` }}
              >
                {act.isGoal ? (
                  <span className="flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[7px] text-white shadow-sm ring-1 ring-rose-300">
                    ⚽
                  </span>
                ) : act.isOnTarget ? (
                  <span
                    className={`block h-2.5 w-2.5 rounded-full border ${
                      act.isHome
                        ? 'bg-emerald-400 border-slate-950 ring-1 ring-emerald-400/60'
                        : 'bg-sky-400 border-slate-950 ring-1 ring-sky-400/60'
                    }`}
                  />
                ) : act.isInsideBox ? (
                  <span className="block h-2 w-2 rounded-full bg-amber-400 border border-slate-950" />
                ) : (
                  <span className="block h-1.5 w-1.5 rounded-full bg-slate-500 border border-slate-950" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Lista Enriquecida de Acontecimentos Recentes com Tradução e Descrição Clara */}
      {actions.length > 0 ? (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Lances Recentes ({actions.length})
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span>{isExpanded ? 'Recolher' : 'Ver todos'}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {isExpanded && (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5 divide-y divide-slate-850/60">
              {sortedActions.map((act) => {
                const formatted = formatTimelineAction(act);
                const isSelected = selectedActionId === act.id;

                return (
                  <div
                    key={act.id}
                    onClick={() => setSelectedActionId(isSelected ? null : act.id)}
                    className={`pt-1.5 first:pt-0 p-2 rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                        : 'bg-slate-900/60 border-slate-850 hover:bg-slate-900 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 flex-wrap">
                      {/* Lado Esquerdo: Minuto + Casa/Fora + Jogador */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="font-mono font-bold text-[9px] sm:text-[10px] text-slate-200 bg-slate-850 px-1 sm:px-1.5 py-0.5 rounded border border-slate-750 shrink-0">
                          {formatted.minuteDisplay}
                        </span>

                        <span
                          className={`font-mono font-bold text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded border shrink-0 whitespace-nowrap ${
                            act.isHome
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                          }`}
                        >
                          {act.isHome ? 'CASA' : 'FORA'}
                        </span>

                        <span className="text-[11px] sm:text-xs font-bold text-slate-200 truncate">
                          {formatted.playerDisplay}
                        </span>
                      </div>

                      {/* Lado Direito: Badge do Tipo de Lance + xG */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded border whitespace-nowrap ${formatted.badgeClass}`}>
                          {formatted.badgeLabel}
                        </span>

                        <span className="font-mono font-bold text-[9px] sm:text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 sm:px-1.5 py-0.5 rounded whitespace-nowrap">
                          {formatted.xgDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Descrição dos Acontecimentos em Português */}
                    <div className="mt-1 text-[11px] text-slate-300 font-sans leading-relaxed bg-slate-950/80 p-2 rounded-lg border border-slate-850">
                      <p className="text-slate-200 font-medium">
                        {formatted.descriptionPt}
                      </p>

                      {formatted.assistPt && (
                        <p className="text-[10px] text-emerald-400/90 font-mono mt-0.5">
                          ↳ {formatted.assistPt}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="py-2 px-2.5 rounded-xl bg-slate-900/40 border border-slate-850 text-center">
          <p className="text-[10px] text-slate-400 font-sans">
            Nenhuma finalização registrada nos últimos 15 minutos ({windowStart}' ao {windowEnd}').
          </p>
        </div>
      )}
    </div>
  );
};
