import React from 'react';
import { Flame, X } from 'lucide-react';
import { TabType } from '../types.ts';

interface TabSummaryProps {
  currentTab: TabType;
  totalInTab: number;
  filteredCount: number;
  hotCount: number;
  megaHotCount: number;
  lastUpdated: string | null;
  activeFilterDescriptions: string[];
  onClearFilters: () => void;
}

export const TabSummary: React.FC<TabSummaryProps> = ({
  currentTab,
  totalInTab,
  filteredCount,
  hotCount,
  megaHotCount,
  lastUpdated,
  activeFilterDescriptions,
  onClearFilters,
}) => {
  const tabTitles: Record<TabType, string> = {
    over_limite: 'LIMITE',
    over_frente: 'A FRENTE',
    over_longa: 'EXPOSIÇÃO',
  };

  const hasActiveFilters = activeFilterDescriptions.length > 0;

  return (
    <section
      id="tab-summary-panel"
      aria-label="Resumo da Janela"
      className="bg-slate-900/95 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
    >
      {/* Left: Tab Title & Counts */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Tab Identifier */}
        <span className="font-bold text-white text-sm tracking-wide text-emerald-400 font-sans">
          {tabTitles[currentTab]}
        </span>

        <span className="text-slate-700 hidden sm:inline" aria-hidden="true">|</span>

        {/* Found Games Count */}
        <div className="text-slate-300 font-mono">
          {hasActiveFilters ? (
            <span>
              Jogos filtrados:{' '}
              <strong className="text-emerald-400 text-sm">{filteredCount}</strong>{' '}
              <span className="text-slate-500 font-normal">de {totalInTab}</span>
            </span>
          ) : (
            <span>
              Jogos monitorados:{' '}
              <strong className="text-white text-sm">{totalInTab}</strong>
            </span>
          )}
        </div>

        {/* Hot & Mega Hot Counters */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[11px] whitespace-nowrap">
            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            Hot: <strong className="font-bold">{hotCount}</strong>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono text-[11px] whitespace-nowrap">
            <Flame className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
            Mega Hot: <strong className="font-bold">{megaHotCount}</strong>
          </span>
        </div>
      </div>

      {/* Right: Filter pills & Last sync */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Active Filter description tag */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-750 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 font-mono">
            <span className="text-slate-400">Filtro:</span>
            <span className="font-semibold text-emerald-300 truncate max-w-[200px] sm:max-w-xs">
              {activeFilterDescriptions.join(' • ')}
            </span>
            <button
              onClick={onClearFilters}
              aria-label="Remover filtros aplicados"
              title="Remover filtros aplicados"
              className="ml-1 p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span>Última leitura: {lastUpdated || 'Calculando...'}</span>
        </div>
      </div>
    </section>
  );
};

