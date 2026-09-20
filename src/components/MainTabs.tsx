import React from 'react';
import { TabType } from '../types.ts';
import { Clock, Zap, Target, Layers } from 'lucide-react';

interface MainTabsProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  counts: {
    all?: number;
    over_limite: number;
    over_frente: number;
    over_longa: number;
  };
}

export const MainTabs: React.FC<MainTabsProps> = ({
  currentTab,
  onSelectTab,
  counts,
}) => {
  const tabs = [
    {
      id: 'all' as TabType,
      title: 'Todos os Jogos',
      count: counts.all ?? (counts.over_limite + counts.over_frente + counts.over_longa),
      icon: Layers,
    },
    {
      id: 'over_limite' as TabType,
      title: 'Limite',
      count: counts.over_limite,
      icon: Clock,
    },
    {
      id: 'over_frente' as TabType,
      title: 'A frente',
      count: counts.over_frente,
      icon: Zap,
    },
    {
      id: 'over_longa' as TabType,
      title: 'Exposição',
      count: counts.over_longa,
      icon: Target,
    },
  ];

  return (
    <nav aria-label="Filtros por Janela de Jogo" className="w-full">
      {/* Container unificado com botões arredondados e sem explicações */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-full p-1.5 sm:p-2 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab.id)}
                className={`px-3.5 py-2 sm:px-4 sm:py-2 rounded-full font-sans font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 border select-none ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                    isActive ? 'text-slate-950' : 'text-slate-400'
                  }`}
                />
                <span className="truncate whitespace-nowrap">{tab.title}</span>
                <span
                  className={`text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950 border-slate-950/30'
                      : 'bg-slate-900 text-slate-300 border-slate-750'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
