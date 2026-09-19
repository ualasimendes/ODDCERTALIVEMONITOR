import React from 'react';
import { TabType } from '../types.ts';
import { Clock, Zap, Target, Layers } from 'lucide-react';

interface TabsNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  counts: {
    all: number;
    over_limite: number;
    over_frente: number;
    over_longa: number;
  };
}

export const TabsNav: React.FC<TabsNavProps> = ({
  currentTab,
  onSelectTab,
  counts,
}) => {
  const tabs = [
    {
      id: 'over_limite' as TabType,
      label: 'OVER LIMITE',
      window: "Minuto > 75'",
      goalRule: 'Falta 1 Gol (+1)',
      refOdd: 'Ref: 2.00',
      count: counts.over_limite,
      icon: Clock,
      color: 'emerald',
    },
    {
      id: 'over_frente' as TabType,
      label: 'OVER À FRENTE',
      window: "60' < Minuto ≤ 75'",
      goalRule: 'Faltam 2 Gols (+2)',
      refOdd: 'Ref: 3.00',
      count: counts.over_frente,
      icon: Zap,
      color: 'amber',
    },
    {
      id: 'over_longa' as TabType,
      label: 'OVER LONGA',
      window: "25' ≤ Minuto ≤ 45'",
      goalRule: 'Faltam 3 Gols (+3)',
      refOdd: 'Ref: 3.00',
      count: counts.over_longa,
      icon: Target,
      color: 'sky',
    },
    {
      id: 'all' as TabType,
      label: 'TODAS AS PARTIDAS',
      window: 'Todas as janelas',
      goalRule: 'Visão Geral',
      refOdd: '-',
      count: counts.all,
      icon: Layers,
      color: 'slate',
    },
  ];

  return (
    <div className="w-full">
      {/* Large Big Tabs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-800/95 border-emerald-500/80 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/50'
                  : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              {/* Active Indicator Strip */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
              )}

              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span
                      className={`text-sm font-bold tracking-wider font-mono block ${
                        isActive ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {tab.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 block">
                      {tab.window}
                    </span>
                  </div>
                </div>

                {/* Counter Pill */}
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950'
                      : tab.count > 0
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : 'bg-slate-850 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </div>

              {/* Subtitle Rule and Reference Odd */}
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/60 font-mono">
                <span className={isActive ? 'text-emerald-300 font-medium' : 'text-slate-400'}>
                  {tab.goalRule}
                </span>
                {tab.refOdd !== '-' && (
                  <span className="text-slate-400 bg-slate-850/80 px-1.5 py-0.5 rounded text-[10px]">
                    {tab.refOdd}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-bar showing count and focus description */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/60 rounded-lg px-3.5 py-2">
        <div>
          <span className="text-slate-400">Exibindo: </span>
          <strong className="text-white font-mono">
            {counts[currentTab] !== undefined ? counts[currentTab] : counts.all}
          </strong>{' '}
          jogos encontrados na janela{' '}
          <span className="text-emerald-400 font-medium font-mono">
            {tabs.find((t) => t.id === currentTab)?.label}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>
            Regra: Linha = Gols Atuais + {currentTab === 'over_limite' ? '1' : '2'} - 0.5 (Ex: 0×0 → Over {currentTab === 'over_limite' ? '0.5' : '1.5'})
          </span>
        </div>
      </div>
    </div>
  );
};
