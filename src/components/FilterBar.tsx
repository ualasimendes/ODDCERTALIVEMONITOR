import React from 'react';
import { Trophy, RotateCcw } from 'lucide-react';

interface FilterBarProps {
  availableCompetitions: string[];
  selectedCompetition: string;
  onSelectCompetition: (comp: string) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  // Optional compatibility props
  [key: string]: any;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  availableCompetitions,
  selectedCompetition,
  onSelectCompetition,
  onResetFilters,
  hasActiveFilters,
}) => {
  return (
    <section
      id="filters-section"
      aria-label="Filtro de campeonatos"
      className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-sm font-mono"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Rótulo do Filtro */}
        <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider font-sans">
            <Trophy className="w-3.5 h-3.5 text-sky-400" />
            <span>Campeonatos:</span>
          </div>

          {hasActiveFilters && (
            <button
              id="btn-clear-filters-mobile"
              type="button"
              onClick={onResetFilters}
              className="sm:hidden text-xs text-slate-300 hover:text-sky-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 transition-colors cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3 text-sky-400" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        {/* Opções Lateralizadas de Campeonatos (Clique Direto) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin flex-1 sm:ml-2">
          <button
            id="filter-comp-all"
            type="button"
            onClick={() => onSelectCompetition('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
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

        {/* Botão Limpar Desktop */}
        {hasActiveFilters && (
          <button
            id="btn-clear-filters-desktop"
            type="button"
            onClick={onResetFilters}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-sky-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-colors cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
            <span>Limpar</span>
          </button>
        )}
      </div>
    </section>
  );
};
