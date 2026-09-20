import React from 'react';
import { RefreshCw } from 'lucide-react';
import { SystemSettings } from '../types.ts';

interface HeaderProps {
  settings?: SystemSettings;
  secondsUntilRefresh: number;
  isRefreshing: boolean;
  apiStatus: 'live' | 'offline' | 'no_data';
  lastSuccessTime: string | null;
  onRefreshNow: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  secondsUntilRefresh,
  isRefreshing,
  lastSuccessTime,
  onRefreshNow,
}) => {
  return (
    <header id="app-header" className="relative bg-slate-950 border-b border-slate-800 sticky top-0 z-30 shadow-md overflow-hidden">
      {/* Imagem de Fundo Preenchendo Toda a Header (Full Width & Height Cover) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/boot_strike_goal.jpg"
          alt="OddCerta Gol ao Vivo"
          className="w-full h-full object-cover object-[center_35%]"
          loading="eager"
        />
        {/* Camadas de fusão e contraste para legibilidade impecável (WCAG AA) */}
        <div className="absolute inset-0 bg-slate-950/70 sm:bg-slate-950/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/50 to-slate-950/80" />
      </div>

      {/* Conteúdo em Primeiro Plano (Sobreposto à Imagem) */}
      <div className="relative z-10 w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex items-center justify-between gap-4">
        {/* Brand & Identity (Lado Esquerdo) */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white font-sans uppercase drop-shadow-md">
              OddCerta
            </h1>
            <p className="text-[11px] text-slate-300 font-sans hidden sm:block drop-shadow-sm font-medium">
              Radar de pressão e janelas de Over em tempo real
            </p>
          </div>
        </div>

        {/* Live Clock & Next Refresh (Lado Direito com Backdrop translúcido) */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 justify-end bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-800/80 shadow-md">
          {/* Timestamps */}
          <div className="flex flex-col text-right font-mono text-[10px] sm:text-[11px] leading-tight text-slate-300">
            <span>
              Última leitura: <strong className="text-white">{lastSuccessTime || 'Iniciando...'}</strong>
            </span>
            <span>
              {isRefreshing ? (
                <span className="text-emerald-400 flex items-center gap-1 justify-end font-semibold">
                  <RefreshCw className="w-3 h-3 animate-spin inline" />
                  Sincronizando...
                </span>
              ) : (
                <span>
                  Próxima leitura: em <strong className="text-emerald-400">{secondsUntilRefresh}s</strong>
                </span>
              )}
            </span>
          </div>

          {/* Action: Manual Refresh Only */}
          <div className="flex items-center gap-1.5">
            <button
              id="btn-refresh-now"
              onClick={onRefreshNow}
              disabled={isRefreshing}
              aria-label="Atualizar dados agora"
              title="Atualizar dados agora"
              className={`p-2 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

