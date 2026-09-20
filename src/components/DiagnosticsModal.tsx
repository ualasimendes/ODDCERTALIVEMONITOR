import React, { useEffect, useState } from 'react';
import { X, CheckCircle, Database, Server, Code, Layers, ShieldCheck } from 'lucide-react';
import { fetchInspection } from '../services/api.ts';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchInspection()
        .then(res => {
          setData(res);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        id="diagnostics-modal"
        className="bg-slate-900 border border-slate-750 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">
                Mapeamento & Diagnóstico de Dados (ESPN API & PostgreSQL)
              </h2>
              <p className="text-xs text-slate-400">
                Verificação de endpoints públicos e campos inspecionados
              </p>
            </div>
          </div>

          <button
            id="btn-close-diagnostics-modal"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto font-mono text-xs">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <span>Inspecionando mapeamento da API pública...</span>
            </div>
          ) : (
            <>
              {/* Card 1: Status Geral */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Provedor Principal:</span>
                  <span className="text-emerald-400 font-bold">ESPN Public API (Sem Autenticação / Sem Chave)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Armazenamento:</span>
                  <span className="text-sky-400 font-bold">PostgreSQL Relacional (Tabelas de Jogos, Snapshots e Sinais)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Frequência Base:</span>
                  <span className="text-white font-bold">30 Segundos (Configurável para 15s, 10s, 5s)</span>
                </div>
              </div>

              {/* Card 2: Mapeamento de Campos Obrigatórios (Section 15) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Mapeamento de Campos Confirmados da ESPN
                </h3>

                <div className="divide-y divide-slate-800/80">
                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Minuto & Relógio</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      status.displayClock & clock
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Placar Atual</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      competitors[].score
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Expected Goals (xG)</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      summary.leaders (expectedGoals)
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Finalizações Totais</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      boxscore.statistics.totalShots
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Finalizações no Gol</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      boxscore.statistics.shotsOnTarget
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Finalizações Fora</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      totalShots - shotsOnTarget - blocked
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Chutes Dentro da Área</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      commentary.location & boxscore
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Chances Claras (Big Chances)</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      commentary[] & athlete stats
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Odds Over / Under</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      summary.odds[] & pickcenter[]
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Tabelas do PostgreSQL */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-400" />
                  Esquema Relacional PostgreSQL
                </h3>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold">competitions</span>
                    <p className="text-slate-400 text-[10px]">Ligas ativas e slugs</p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold">games</span>
                    <p className="text-slate-400 text-[10px]">Partidas e placares</p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold">game_snapshots</span>
                    <p className="text-slate-400 text-[10px]">Evolução temporal contínua</p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold">signals</span>
                    <p className="text-slate-400 text-[10px]">Classificação em abas & intensidade</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-end">
          <button
            id="btn-close-diag-bottom"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono cursor-pointer"
          >
            Fechar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
};
