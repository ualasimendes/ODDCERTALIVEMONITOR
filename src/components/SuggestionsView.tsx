import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Flame,
  Zap,
  Target,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save,
  Info,
  Check,
} from 'lucide-react';
import {
  LiveSuggestionItem,
  SuggestionCriteriaConfig,
  SuggestionStatus,
  SuggestionsSummary,
  SuggestionType,
} from '../types';
import { fetchSuggestionCriteria, updateSuggestionCriteria } from '../services/api';

interface SuggestionsViewProps {
  suggestions: LiveSuggestionItem[];
  summary: SuggestionsSummary;
  isLoading: boolean;
  onRefresh: () => void;
}

export const SuggestionsView: React.FC<SuggestionsViewProps> = ({
  suggestions,
  summary,
  isLoading,
  onRefresh,
}) => {
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<SuggestionType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Painel de Critérios e Parâmetros
  const [isCriteriaOpen, setIsCriteriaOpen] = useState(false);
  const [criteria, setCriteria] = useState<SuggestionCriteriaConfig>({
    unilateralMinXgDiff: 0.20,
    unilateralMinDominantXg: 0.20,
    unilateralMaxOpponentXg: 0.00,
    unilateralDominanceRatio: 2.5,
    unilateralMinDominantShots: 2,
    unilateralMinDominantSot: 1,
    openGameMinMutualXg: 0.04,
    openGameMinCombinedXg: 0.12,
    openGameMinCombinedShots: 3,
    minMinute: 10,
    maxMinute: 88,
    minOddValue: 1.25,
  });
  const [isSavingCriteria, setIsSavingCriteria] = useState(false);
  const [criteriaSuccessMsg, setCriteriaSuccessMsg] = useState(false);

  // Carregar critérios do backend ao montar
  useEffect(() => {
    fetchSuggestionCriteria()
      .then((c) => {
        if (c) setCriteria(c);
      })
      .catch((err) => console.error('Erro ao carregar critérios:', err));
  }, []);

  const handleSaveCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCriteria(true);
    try {
      const updated = await updateSuggestionCriteria(criteria);
      if (updated) setCriteria(updated);
      setCriteriaSuccessMsg(true);
      setTimeout(() => setCriteriaSuccessMsg(false), 2500);
      onRefresh();
    } catch (err) {
      console.error('Erro ao salvar critérios:', err);
    } finally {
      setIsSavingCriteria(false);
    }
  };

  // Filtering
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && s.type !== typeFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const home = s.homeTeam.name.toLowerCase();
        const away = s.awayTeam.name.toLowerCase();
        const comp = s.competitionName.toLowerCase();
        const text = s.suggestionText.toLowerCase();
        if (
          !home.includes(query) &&
          !away.includes(query) &&
          !comp.includes(query) &&
          !text.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [suggestions, statusFilter, typeFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* 1. PAINEL DE KPIS / ESTATÍSTICAS DE ASSERTIVIDADE */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total de Sugestões */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider font-sans">Total Sugerido</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">{summary.total}</span>
            <span className="text-[11px] text-slate-400 font-sans">oportunidades</span>
          </div>
        </div>

        {/* Certeiras (Green) */}
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-emerald-400 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider font-sans">Certeiras (Green)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">{summary.greens}</span>
            <span className="text-[11px] text-emerald-300/80 font-sans">acertos</span>
          </div>
        </div>

        {/* Em Aberto / Ao Vivo (Pendente) */}
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-amber-400 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider font-sans">Ao Vivo (Pendente)</span>
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-400">{summary.pending}</span>
            <span className="text-[11px] text-amber-300/80 font-sans">em andamento</span>
          </div>
        </div>

        {/* Não Concretizadas (Red) */}
        <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-rose-400 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider font-sans">Não Concretizadas</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-400">{summary.reds}</span>
            <span className="text-[11px] text-rose-300/80 font-sans">erros</span>
          </div>
        </div>

        {/* Taxa de Assertividade */}
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-300 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider font-sans">Taxa de Acerto</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-black font-mono text-emerald-400">
                {summary.greens + summary.reds > 0 ? `${summary.accuracyRate}%` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {summary.greens}/{summary.greens + summary.reds} liquidadas
              </span>
            </div>
            {/* Barra de Progresso */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${summary.accuracyRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. PAINEL EXPANSÍVEL: PARÂMETROS E CRITÉRIOS DO ALGORITMO */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all">
        <button
          type="button"
          onClick={() => setIsCriteriaOpen(!isCriteriaOpen)}
          className="w-full px-4 py-3 flex items-center justify-between bg-slate-950/70 hover:bg-slate-950 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider font-sans text-slate-200">
              Critérios & Parâmetros das Entradas Sugeridas
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              Calibração Ativa
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs font-sans">
            <span>{isCriteriaOpen ? 'Ocultar regras' : 'Ver e ajustar parâmetros'}</span>
            {isCriteriaOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isCriteriaOpen && (
          <div className="p-4 border-t border-slate-800/80 space-y-4 bg-slate-950/40">
            {/* Cards Explicativos dos 2 Padrões */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* PADRÃO 1: PRESSÃO UNILATERAL */}
              <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold font-sans text-white">
                      Padrão 1: Pressão Unilateral
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    Back Dominante / Lay Oponente
                  </span>
                </div>

                <div className="text-xs font-sans text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    Identifica quando um time está com <strong className="text-emerald-400">pressão agressiva desproporcional</strong> e o adversário está completamente acuado com <strong className="text-slate-200">zero perigo ofensivo</strong>.
                  </p>
                  <div className="bg-slate-900/95 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 border border-slate-800 space-y-1">
                    <div className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/25 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Fórmula: (xG A - xG B &gt;= {(criteria.unilateralMinXgDiff ?? 0.20).toFixed(2)}) AND (xG B &lt;= {(criteria.unilateralMaxOpponentXg ?? 0.00).toFixed(2)})</span>
                    </div>
                    <div className="pt-0.5 space-y-0.5 text-slate-400">
                      <div>• Dif. xG (xG A - xG B): <span className="text-emerald-400 font-bold">&gt;= {(criteria.unilateralMinXgDiff ?? 0.20).toFixed(2)}</span> (20 centésimos)</div>
                      <div>• xG Adversário (xG B): <span className="text-rose-400 font-bold">&lt;= {(criteria.unilateralMaxOpponentXg ?? 0.00).toFixed(2)}</span> (zerado)</div>
                      <div>• xG Mín Dominante (xG A): <span className="text-emerald-400 font-bold">&gt;= {(criteria.unilateralMinDominantXg ?? 0.20).toFixed(2)}</span></div>
                    </div>
                  </div>
                  <div className="text-[11px] font-sans text-slate-400 italic">
                    Exemplo: <em>"O Dallas está pressionando o Austin e um gol pode sair em breve. Sugestão: Back Dallas, ou Lay Austin"</em>
                  </div>
                </div>
              </div>

              {/* PADRÃO 2: LÁ E CÁ (JOGO ABERTO) */}
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold font-sans text-white">
                      Padrão 2: Lá e Cá (Jogo Aberto)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                    Over da Janela Alvo
                  </span>
                </div>

                <div className="text-xs font-sans text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    Identifica quando <strong className="text-amber-400">ambos os times estão criando xG e finalizações simultaneamente</strong> em ritmo acelerado de transições.
                  </p>
                  <div className="bg-slate-900/95 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 border border-slate-800 space-y-1">
                    <div className="text-amber-400 font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/25 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Fórmula: (xG A &gt;= {(criteria.openGameMinMutualXg ?? 0.04).toFixed(2)} AND xG B &gt;= {(criteria.openGameMinMutualXg ?? 0.04).toFixed(2)})</span>
                    </div>
                    <div className="pt-0.5 space-y-0.5 text-slate-400">
                      <div>• xG Mútuo de Cada Time: <span className="text-amber-400 font-bold">&gt;= {(criteria.openGameMinMutualXg ?? 0.04).toFixed(2)}</span></div>
                      <div>• xG Combinado na Janela: <span className="text-amber-400 font-bold">&gt;= {(criteria.openGameMinCombinedXg ?? 0.12).toFixed(2)}</span></div>
                      <div>• Linha Over: <span className="text-white font-bold">Over Linha Atual (Placar + 0.5)</span></div>
                    </div>
                  </div>
                  <div className="text-[11px] font-sans text-slate-400 italic">
                    Exemplo: <em>"O D.C. United e o Charlotte FC estão em um jogo agressivo de lá e cá, um gol deverá sair em breve. Sugestão: Over 2.5 Odd 2.00"</em>
                  </div>
                </div>
              </div>
            </div>

            {/* FORMULÁRIO DE AJUSTE DOS CRITÉRIOS EM TEMPO REAL */}
            <form onSubmit={handleSaveCriteria} className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-sans uppercase tracking-wider text-slate-300">
                  Ajuste Fino dos Limiares (Configuração em Tempo Real)
                </span>
                {criteriaSuccessMsg && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg animate-fade-in">
                    <Check className="w-3.5 h-3.5" />
                    Parâmetros salvos com sucesso!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs font-mono">
                {/* unilateralMinXgDiff (xG A - xG B >= 0.20) */}
                <div className="space-y-1">
                  <label className="text-[10px] text-emerald-400 font-bold block truncate" title="Diferença mínima entre o dominante e o adversário (xG A - xG B)">
                    Dif Mín xG (A - B)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    max="1.5"
                    value={criteria.unilateralMinXgDiff ?? 0.20}
                    onChange={(e) => setCriteria({ ...criteria, unilateralMinXgDiff: parseFloat(e.target.value) || 0.20 })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-emerald-500/40 rounded-lg text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* maxOpponentXg (xG B <= 0.00) */}
                <div className="space-y-1">
                  <label className="text-[10px] text-rose-400 font-bold block truncate" title="xG máximo tolerado para o adversário (xG B = 0)">
                    xG Máx Oponente (B)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.0"
                    max="0.5"
                    value={criteria.unilateralMaxOpponentXg ?? 0.00}
                    onChange={(e) => setCriteria({ ...criteria, unilateralMaxOpponentXg: parseFloat(e.target.value) ?? 0.00 })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-rose-500/40 rounded-lg text-rose-300 font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* minDominantXg (xG A >= 0.20) */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="xG mínimo do time dominante (xG A)">
                    xG Mín Dominante (A)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    max="1.5"
                    value={criteria.unilateralMinDominantXg ?? 0.20}
                    onChange={(e) => setCriteria({ ...criteria, unilateralMinDominantXg: parseFloat(e.target.value) || 0.20 })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* dominanceRatio */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Razão de dominância xG (Dominante / Oponente)">
                    Razão Dominância
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.5"
                    max="10.0"
                    value={criteria.unilateralDominanceRatio ?? 2.5}
                    onChange={(e) => setCriteria({ ...criteria, unilateralDominanceRatio: parseFloat(e.target.value) || 2.5 })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* openGameMinMutualXg */}
                <div className="space-y-1">
                  <label className="text-[10px] text-amber-400 font-bold block truncate" title="xG mínimo mútuo de cada time no Lá e Cá">
                    xG Mútuo Lá e Cá
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="0.5"
                    value={criteria.openGameMinMutualXg ?? 0.04}
                    onChange={(e) => setCriteria({ ...criteria, openGameMinMutualXg: parseFloat(e.target.value) || 0.04 })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-amber-500/40 rounded-lg text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* openGameMinCombinedXg */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="xG combinado da partida no Lá e Cá">
                    xG Soma Lá e Cá
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    max="1.0"
                    value={criteria.openGameMinCombinedXg ?? 0.12}
                    onChange={(e) => setCriteria({ ...criteria, openGameMinCombinedXg: parseFloat(e.target.value) || 0.12 })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* minMinute */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Minuto inicial para começar a sugerir">
                    Minuto Inicial
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="45"
                    value={criteria.minMinute}
                    onChange={(e) => setCriteria({ ...criteria, minMinute: parseInt(e.target.value, 10) || 10 })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* maxMinute */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Minuto limite para encerrar sugestões">
                    Minuto Limite
                  </label>
                  <input
                    type="number"
                    min="70"
                    max="90"
                    value={criteria.maxMinute}
                    onChange={(e) => setCriteria({ ...criteria, maxMinute: parseInt(e.target.value, 10) || 88 })}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 font-sans">
                  Auditoria automática: <strong className="text-emerald-400">Green</strong> ao sair gol do dominante ou bater a linha Over; <strong className="text-rose-400">Red</strong> se encerrar sem gol.
                </span>
                <button
                  type="submit"
                  disabled={isSavingCriteria}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-sans text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingCriteria ? 'Salvando...' : 'Salvar Parâmetros'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* 3. BARRA DE CONTROLE, FILTROS E BUSCA */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Filtros de Status (Tabs Padrão UI/UX Pro Max) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-sans font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              statusFilter === 'ALL'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <span>Todas</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                statusFilter === 'ALL' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {summary.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('PENDENTE')}
            className={`px-3 py-1.5 rounded-xl font-sans font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              statusFilter === 'PENDENTE'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Ao Vivo</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                statusFilter === 'PENDENTE' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {summary.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('GREEN')}
            className={`px-3 py-1.5 rounded-xl font-sans font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              statusFilter === 'GREEN'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Certeiras</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                statusFilter === 'GREEN' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {summary.greens}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('RED')}
            className={`px-3 py-1.5 rounded-xl font-sans font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              statusFilter === 'RED'
                ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
            <span>Não Bateu</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                statusFilter === 'RED' ? 'bg-slate-950/20 text-white' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {summary.reds}
            </span>
          </button>
        </div>

        {/* Tipo de Padrão & Campo de Busca */}
        <div className="flex items-center gap-2">
          {/* Seletor de Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-sans text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">Todos os Padrões</option>
            <option value="UNILATERAL_HOME">Pressão Unilateral (Mandante)</option>
            <option value="UNILATERAL_AWAY">Pressão Unilateral (Visitante)</option>
            <option value="OVER_OPEN_GAME">Lá e Cá (Jogo Aberto / Over)</option>
          </select>

          {/* Busca */}
          <div className="relative min-w-[160px] sm:min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar time ou liga..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-sans text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Botão Atualizar */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Atualizar sugestões agora"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4. LISTAGEM EM COLUNAS ORGANIZADAS (TABELA / CARDS RESPONSIVOS) */}
      {filteredSuggestions.length > 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Cabeçalho da Tabela em Telas Maiores */}
          <div className="hidden lg:grid grid-cols-[130px_100px_230px_160px_120px_1fr_120px_150px] items-center gap-3 px-4 py-3 bg-slate-950/90 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">
            <div>Status</div>
            <div>Minuto & Placar</div>
            <div>Partida & Liga</div>
            <div>Padrão</div>
            <div className="text-center">xG 15' / 10' / 5'</div>
            <div>Sugestão Recomendada</div>
            <div className="text-center">Mercado & Odd</div>
            <div>Auditoria / Desfecho</div>
          </div>

          {/* Linhas da Tabela */}
          <div className="divide-y divide-slate-800/80">
            {filteredSuggestions.map((item) => {
              const isGreen = item.status === 'GREEN';
              const isRed = item.status === 'RED';
              const isPending = item.status === 'PENDENTE';
              const isOpenGame = item.type === 'OVER_OPEN_GAME';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 lg:px-4 lg:py-3.5 transition-colors hover:bg-slate-850/50 ${
                    isGreen
                      ? 'bg-emerald-950/10'
                      : isRed
                      ? 'bg-rose-950/10'
                      : 'bg-transparent'
                  }`}
                >
                  {/* Grid Layout em Desktop / Card em Mobile */}
                  <div className="grid grid-cols-1 lg:grid-cols-[130px_100px_230px_160px_120px_1fr_120px_150px] items-center gap-3">
                    {/* COLUNA 1: STATUS BADGE */}
                    <div className="flex items-center gap-2">
                      {isGreen && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-sans font-bold text-xs whitespace-nowrap shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Certeira</span>
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 font-sans font-bold text-xs whitespace-nowrap shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          <span>Ao Vivo</span>
                        </span>
                      )}
                      {isRed && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 font-sans font-bold text-xs whitespace-nowrap shadow-sm">
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Não Bateu</span>
                        </span>
                      )}
                    </div>

                    {/* COLUNA 2: MINUTO & MOMENTO */}
                    <div className="flex lg:flex-col items-center lg:items-start justify-between lg:justify-center text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                          {item.minute}'
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          ({item.scoreAtTime.home}x{item.scoreAtTime.away})
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 lg:mt-0.5">
                        Agora: {item.currentScore.home}x{item.currentScore.away}
                      </div>
                    </div>

                    {/* COLUNA 3: PARTIDA & LIGA */}
                    <div className="space-y-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate font-sans">
                        {item.competitionName}
                      </div>
                      <div className="space-y-0.5 text-xs font-sans">
                        <div className="flex items-center gap-1.5">
                          {item.homeTeam.logoUrl ? (
                            <img
                              src={item.homeTeam.logoUrl}
                              alt={item.homeTeam.name}
                              className="w-3.5 h-3.5 object-contain shrink-0"
                            />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          )}
                          <span
                            className={`truncate ${
                              item.dominantTeam === 'home'
                                ? 'font-bold text-emerald-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {item.homeTeam.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.awayTeam.logoUrl ? (
                            <img
                              src={item.awayTeam.logoUrl}
                              alt={item.awayTeam.name}
                              className="w-3.5 h-3.5 object-contain shrink-0"
                            />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                          )}
                          <span
                            className={`truncate ${
                              item.dominantTeam === 'away'
                                ? 'font-bold text-sky-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {item.awayTeam.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* COLUNA 4: PADRÃO IDENTIFICADO */}
                    <div>
                      {isOpenGame ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-sans font-semibold">
                          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Lá e Cá</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-sans font-semibold">
                          <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Pressão {item.dominantTeam === 'home' ? 'Mandante' : 'Visitante'}</span>
                        </div>
                      )}
                    </div>

                    {/* COLUNA 5: MÉTRICAS xG RECENTES (15', 10', 5') */}
                    <div className="text-center font-mono text-xs">
                      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-1.5 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="text-emerald-400 font-bold">
                            {item.metrics.homeXg15 !== null ? item.metrics.homeXg15.toFixed(2) : '0.00'}
                          </span>
                          <span className="text-slate-500 text-[9px]">15'</span>
                          <span className="text-sky-400 font-bold">
                            {item.metrics.awayXg15 !== null ? item.metrics.awayXg15.toFixed(2) : '0.00'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="text-emerald-400 font-bold">
                            {item.metrics.homeXg10 !== null ? item.metrics.homeXg10.toFixed(2) : '0.00'}
                          </span>
                          <span className="text-slate-500 text-[9px]">10'</span>
                          <span className="text-sky-400 font-bold">
                            {item.metrics.awayXg10 !== null ? item.metrics.awayXg10.toFixed(2) : '0.00'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="text-emerald-400 font-bold">
                            {item.metrics.homeXg5 !== null ? item.metrics.homeXg5.toFixed(2) : '0.00'}
                          </span>
                          <span className="text-slate-500 text-[9px]">5'</span>
                          <span className="text-sky-400 font-bold">
                            {item.metrics.awayXg5 !== null ? item.metrics.awayXg5.toFixed(2) : '0.00'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* COLUNA 6: SUGESTÃO RECOMENDADA (TEXTO EXATO) */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-xs font-sans text-slate-200 leading-relaxed shadow-inner space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="font-medium text-slate-100">{item.suggestionText}</span>
                      </div>
                      {item.triggerReason && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[10.5px] font-mono text-emerald-300">
                          <Target className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate" title={item.triggerReason}>
                            Gatilho: {item.triggerReason}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* COLUNA 7: MERCADO & ODD */}
                    <div className="text-center font-mono">
                      <div className="inline-flex flex-col items-center px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[11px] font-bold text-slate-300">
                          {item.marketDescription}
                        </span>
                        {item.odd && (
                          <span className="text-xs font-black text-emerald-400">
                            Odd: {item.odd.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* COLUNA 8: AUDITORIA / DESFECHO */}
                    <div className="text-xs font-sans">
                      {isGreen && (
                        <div className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1.5 rounded-xl font-medium text-[11px]">
                          {item.resultNote || 'Gol saiu com sucesso!'}
                        </div>
                      )}
                      {isPending && (
                        <div className="text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1.5 rounded-xl text-[11px]">
                          Jogo em andamento ({item.currentScore.home}x{item.currentScore.away})
                        </div>
                      )}
                      {isRed && (
                        <div className="text-rose-300 bg-rose-500/10 border border-rose-500/25 px-2.5 py-1.5 rounded-xl text-[11px]">
                          {item.resultNote || 'Encerrado sem gol'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ESTADO VAZIO EXPLICATIVO */
        <div className="py-16 px-4 bg-slate-900/60 border border-slate-800 rounded-3xl text-center font-mono flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
            <Target className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-200">Nenhuma sugestão encontrada</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {statusFilter !== 'ALL' || typeFilter !== 'ALL' || searchQuery
                ? 'Nenhuma oportunidade corresponde aos filtros ativos no momento.'
                : 'As oportunidades são geradas automaticamente quando o sistema detecta xG recente discrepante (Pressão Unilateral) ou jogo agressivo de Lá e Cá.'}
            </p>
          </div>
          {(statusFilter !== 'ALL' || typeFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl border border-emerald-500/40 text-xs font-bold font-sans cursor-pointer transition-colors"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
};
