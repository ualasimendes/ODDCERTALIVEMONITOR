import React from 'react';
import { TabType } from '../types.ts';
import { Clock, Zap, Target } from 'lucide-react';

interface MainTabsProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  counts: {
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
      id: 'over_limite' as TabType,
      title: 'Limite',
      subtitle: 'Over Limite',
      count: counts.over_limite,
      window: '> 75\'',
      targetRule: '+1 gol',
      refOdd: '2.00',
      icon: Clock,
      accentColor: 'emerald',
    },
    {
      id: 'over_frente' as TabType,
      title: 'A frente',
      subtitle: 'Over à Frente',
      count: counts.over_frente,
      window: '60\'-75\'',
      targetRule: '+2 gols',
      refOdd: '3.00',
      icon: Zap,
      accentColor: 'amber',
    },
    {
      id: 'over_longa' as TabType,
      title: 'Exposição',
      subtitle: 'Over Exposição',
      count: counts.over_longa,
      window: '25\'-45\'',
      targetRule: '+3 gols',
      refOdd: '3.00',
      icon: Target,
      accentColor: 'sky',
    },
  ];

  return (
    <nav aria-label="Filtros: Limite | A frente | Exposição" className="w-full">
      {/* Container unificado lado a lado com bordas matemáticas */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-1.5 shadow-sm">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {tabs.map((tab, idx) => {
            const isActive = currentTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab.id)}
                className={`relative rounded-lg p-2.5 sm:p-3 text-left transition-all cursor-pointer overflow-hidden flex flex-col justify-between border ${
                  isActive
                    ? 'bg-slate-950 border-emerald-500/80 shadow-sm ring-1 ring-emerald-500/40 text-white'
                    : 'bg-slate-900/60 hover:bg-slate-850/80 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {/* Linha superior de destaque na aba ativa */}
                {isActive && (
                  <span className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400"></span>
                )}

                {/* Linha Principal: Título da Aba + Contador */}
                <div className="flex items-center justify-between gap-1 mb-1 sm:mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                        isActive
                          ? tab.accentColor === 'emerald'
                            ? 'text-emerald-400'
                            : tab.accentColor === 'amber'
                            ? 'text-amber-400'
                            : 'text-sky-400'
                          : 'text-slate-400'
                      }`}
                    />
                    <span
                      className={`text-xs sm:text-sm font-bold tracking-tight font-sans truncate whitespace-nowrap ${
                        isActive ? 'text-white' : 'text-slate-200'
                      }`}
                    >
                      {tab.title}
                    </span>
                  </div>

                  {/* Badge numérico com contagem */}
                  <span
                    className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-750'
                    }`}
                  >
                    {tab.count}
                  </span>
                </div>

                {/* Linha Secundária: Janela de Minuto e Regra de Alvo */}
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono pt-1.5 border-t border-slate-800/60 gap-1">
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      isActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {tab.window}
                  </span>

                  <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                    Alvo: <strong className="text-slate-200">{tab.targetRule}</strong>
                  </span>

                  <span className="text-slate-500 text-[9px] sm:text-[10px] whitespace-nowrap">
                    Ref: {tab.refOdd}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

