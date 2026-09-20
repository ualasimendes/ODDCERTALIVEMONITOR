import React, { useEffect, useState } from 'react';
import { X, Sliders, Check, Globe, RefreshCw, AlertCircle } from 'lucide-react';
import { fetchCompetitions, toggleCompetition, updateSettings } from '../services/api.ts';
import { CompetitionConfig, SystemSettings } from '../types.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: SystemSettings;
  onSettingsUpdated: (newSettings: SystemSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSettingsUpdated,
}) => {
  const [competitions, setCompetitions] = useState<CompetitionConfig[]>([]);
  const [intervalSec, setIntervalSec] = useState<number>(currentSettings.pollIntervalSeconds || 60);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIntervalSec(currentSettings.pollIntervalSeconds || 60);
      fetchCompetitions()
        .then(setCompetitions)
        .catch(console.error);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleToggleComp = async (id: string, current: boolean) => {
    try {
      await toggleCompetition(id, !current);
      setCompetitions(prev =>
        prev.map(c => (c.id === id ? { ...c, isActive: !current } : c))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveInterval = async (val: number) => {
    setIntervalSec(val);
    setIsSaving(true);
    try {
      const updated = await updateSettings({ pollIntervalSeconds: val });
      onSettingsUpdated(updated);
      setStatusMsg(`Intervalo atualizado para ${val}s`);
      setTimeout(() => setStatusMsg(''), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        id="settings-modal"
        className="bg-slate-900 border border-slate-750 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">
                Configurações do Monitor
              </h2>
              <p className="text-xs text-slate-400">
                Frequência de atualização e cobertura de competições
              </p>
            </div>
          </div>

          <button
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto font-mono text-xs">
          {/* Status Alert */}
          {statusMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Section 1: Intervalo de Atualização (Section 11) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <label className="text-xs font-bold text-slate-200 block mb-1 uppercase tracking-wider">
              Intervalo de Atualização Automática
            </label>
            <p className="text-[11px] text-slate-400 mb-3">
              Defina a cadência de requisição de dados públicos. O sistema recalcula xG recente e grava snapshots periodicamente.
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[60, 30, 15, 10].map(sec => (
                <button
                  key={sec}
                  id={`btn-interval-${sec}`}
                  onClick={() => handleSaveInterval(sec)}
                  disabled={isSaving}
                  className={`py-2 px-3 rounded-lg font-bold border transition-colors cursor-pointer ${
                    intervalSec === sec
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {sec} segundos {sec === 60 ? '(Padrão)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Odds de Referência (Section 4) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <label className="text-xs font-bold text-slate-200 block mb-1 uppercase tracking-wider">
              Odds de Referência por Aba
            </label>
            <p className="text-[11px] text-slate-400 mb-3">
              Valores mínimos de referência definidos para indicar se a odd está acima do limite configurado.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">Limite (&gt;75')</span>
                <span className="text-base font-bold text-emerald-400 mt-1 block">2.00</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">A Frente (60'-75')</span>
                <span className="text-base font-bold text-amber-400 mt-1 block">3.00</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 uppercase block">Exposição (25'-45')</span>
                <span className="text-base font-bold text-sky-400 mt-1 block">3.00</span>
              </div>
            </div>
          </div>

          {/* Section 3: Ligas & Competições Ativas (Section 16) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                Competições Cobertas (ESPN)
              </label>
              <span className="text-[10px] text-slate-400">
                {competitions.filter(c => c.isActive).length} ativas
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Ative ou desative ligas conforme sua preferência de monitoramento:
            </p>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {competitions.map(comp => (
                <div
                  key={comp.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 hover:border-slate-750"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-white font-medium">{comp.name}</span>
                    <span className="text-slate-400 text-[10px]">({comp.country})</span>
                  </div>

                  <button
                    id={`toggle-comp-${comp.id}`}
                    onClick={() => handleToggleComp(comp.id, comp.isActive)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                      comp.isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500 border border-slate-750'
                    }`}
                  >
                    {comp.isActive ? 'ATIVA' : 'INATIVA'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-end">
          <button
            id="btn-close-settings-modal-bottom"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
