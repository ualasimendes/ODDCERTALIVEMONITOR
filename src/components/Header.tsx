import React from 'react';
import { Activity, RefreshCw, Settings, Radio } from 'lucide-react';
import { SystemSettings } from '../types.ts';

interface HeaderProps {
  settings: SystemSettings;
  secondsUntilRefresh: number;
  isRefreshing: boolean;
  apiStatus: 'live' | 'offline' | 'no_data';
  lastSuccessTime: string | null;
  onRefreshNow: () => void;
  onToggleAutoRefresh: () => void;
  onOpenSettings: () => void;
  onOpenDiagnostics: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  secondsUntilRefresh,
  isRefreshing,
  apiStatus,
  lastSuccessTime,
  onRefreshNow,
  onOpenSettings,
  onOpenDiagnostics,
}) => {
  return (
    <header id="app-header" className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-black text-base shadow-inner">
            OC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white font-sans uppercase">
                OddCerta
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tracking-wider whitespace-nowrap">
                LIVE MONITOR
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
              Radar de pressão e janelas de Over em tempo real
            </p>
          </div>
        </div>

        {/* Live Status, Clock & Next Refresh */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Status Indicator */}
          {apiStatus === 'offline' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="font-bold">OFFLINE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs whitespace-nowrap">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="font-bold">AO VIVO</span>
            </div>
          )}

          {/* Timestamps */}
          <div className="hidden md:flex flex-col text-right font-mono text-[11px] leading-tight text-slate-400">
            <span>
              Última leitura: <strong className="text-slate-200">{lastSuccessTime || 'Iniciando...'}</strong>
            </span>
            <span>
              {isRefreshing ? (
                <span className="text-emerald-400 flex items-center gap-1 justify-end font-semibold">
                  <RefreshCw className="w-3 h-3 animate-spin inline" />
                  Sincronizando...
                </span>
              ) : (
                <span>
                  Próxima leitura: em <strong className="text-slate-200">{secondsUntilRefresh}s</strong>
                </span>
              )}
            </span>
          </div>

          {/* Actions: Refresh Now & Settings */}
          <div className="flex items-center gap-1.5">
            <button
              id="btn-refresh-now"
              onClick={onRefreshNow}
              disabled={isRefreshing}
              aria-label="Atualizar dados agora"
              title="Atualizar dados agora"
              className={`p-2.5 rounded-lg border border-slate-750 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 hover:text-white transition-all cursor-pointer ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              id="btn-diagnostics"
              onClick={onOpenDiagnostics}
              aria-label="Diagnóstico de dados"
              title="Diagnóstico de dados"
              className="p-2.5 rounded-lg border border-slate-750 bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
            >
              <Activity className="w-4 h-4 text-sky-400" />
            </button>

            <button
              id="btn-settings"
              onClick={onOpenSettings}
              aria-label="Configurações do monitor"
              title="Configurações do monitor"
              className="p-2.5 rounded-lg border border-slate-750 bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

