import React from 'react';
import { Trophy, RotateCcw, Flame } from 'lucide-react';
import { IntensityLevel } from '../types.ts';

interface FilterBarProps {
  availableCompetitions: string[];
  selectedCompetition: string;
  onSelectCompetition: (comp: string) => void;
  selectedIntensity?: IntensityLevel | 'ALL';
  onSelectIntensity?: (intensity: IntensityLevel | 'ALL') => void;
  onlyPreGoal?: boolean;
  onTogglePreGoal?: () => void;
  preGoalCount?: number;
  hotCounts?: { all: number; hot: number; mega_hot: number };
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  // Optional compatibility props
  [key: string]: any;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  availableCompetitions,
  selectedCompetition,
  onSelectCompetition,
  selectedIntensity = 'ALL',
  onSelectIntensity,
  onlyPreGoal = false,
  onTogglePreGoal,
  preGoalCount = 0,
  hotCounts = { all: 0, hot: 0, mega_hot: 0 },
  onResetFilters,
  hasActiveFilters,
}) => {
  return (
    <section
      id="filters-section"
      aria-label="Filtros de intensidade e campeonatos"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-sm font-mono space-y-2.5"
    >
      {/* LINHA 1: FILTRO DE INTENSIDADE (HOT E MEGA HOT) */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider font-sans shrink-0">
          <Flame className="w-4 h-4 text-amber-400" />
          <span>Pressão Recente:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Botão Todos */}
          <button
            id="filter-intensity-all"
            type="button"
            onClick={() => onSelectIntensity?.('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              selectedIntensity === 'ALL'
                ? 'bg-slate-800 text-white border-slate-600 ring-1 ring-slate-500/30'
                : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-900 border border-slate-750 text-slate-300">
              {hotCounts.all}
            </span>
          </button>

          {/* Botão HOT */}
          <button
            id="filter-intensity-hot"
            type="button"
            onClick={() => onSelectIntensity?.(selectedIntensity === 'HOT' ? 'ALL' : 'HOT')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              selectedIntensity === 'HOT'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-950/40 ring-1 ring-amber-400'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 shrink-0 ${selectedIntensity === 'HOT' ? 'fill-slate-950' : 'fill-amber-400 text-amber-400'}`} />
            <span>HOT</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border ${
                selectedIntensity === 'HOT'
                  ? 'bg-slate-950/20 text-slate-950 border-slate-950/30'
                  : 'bg-amber-500/20 text-amber-200 border-amber-500/30'
              }`}
            >
              {hotCounts.hot}
            </span>
          </button>

          {/* Botão MEGA HOT */}
          <button
            id="filter-intensity-megahot"
            type="button"
            onClick={() => onSelectIntensity?.(selectedIntensity === 'MEGA_HOT' ? 'ALL' : 'MEGA_HOT')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              selectedIntensity === 'MEGA_HOT'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/50 ring-1 ring-rose-400 animate-pulse'
                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}
          >
            <Flame className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>MEGA HOT</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border ${
                selectedIntensity === 'MEGA_HOT'
                  ? 'bg-slate-950/20 text-white border-white/30'
                  : 'bg-rose-500/20 text-rose-200 border-rose-500/30'
              }`}
            >
              {hotCounts.mega_hot}
            </span>
          </button>

          {/* Divisor Sutil */}
          <div className="h-4 w-px bg-slate-800 mx-0.5 hidden sm:block"></div>

          {/* Botão PRÉ-GOL (Filtra apenas jogos SEM gol recente) */}
          <button
            id="filter-only-pre-goal"
            type="button"
            onClick={onTogglePreGoal}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              onlyPreGoal
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}
            title="Oculta jogos onde acabou de sair gol. Mostra apenas pressão de abafa pré-gol (sem gol nos últimos 12 minutos)."
          >
            <span className="text-xs">🎯</span>
            <span>Pré-Gol</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border ${
                onlyPreGoal
                  ? 'bg-slate-950/20 text-slate-950 border-slate-950/30'
                  : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
              }`}
            >
              {preGoalCount}
            </span>
          </button>

          {/* Botão Limpar Filtros se houver algum ativo */}
          {hasActiveFilters && (
            <button
              id="btn-clear-filters-main"
              type="button"
              onClick={onResetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-colors cursor-pointer active:scale-95 whitespace-nowrap ml-auto"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3 h-3 text-sky-400" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* LINHA 2: FILTRO DE CAMPEONATOS */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider font-sans shrink-0">
          <Trophy className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Campeonatos:</span>
        </div>

        {/* Opções Lateralizadas de Campeonatos (Clique Direto) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin flex-1">
          <button
            id="filter-comp-all"
            type="button"
            onClick={() => onSelectCompetition('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCompetition === 'ALL'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 ring-1 ring-sky-500/30'
                : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800/90'
            }`}
          >
            Todos ({availableCompetitions.length})
          </button>

          {availableCompetitions.map((comp) => {
            const isSelected = selectedCompetition === comp;
            return (
              <button
                key={comp}
                id={`filter-comp-${comp.replace(/\s+/g, '-').toLowerCase()}`}
                type="button"
                onClick={() => onSelectCompetition(comp)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 ring-1 ring-sky-500/30'
                    : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800/90'
                }`}
              >
                {comp}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
