import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Header } from './components/Header.tsx';
import { MainTabs } from './components/MainTabs.tsx';
import { FilterBar } from './components/FilterBar.tsx';
import { CompetitionGroup } from './components/CompetitionGroup.tsx';
import { MatchDetailModal } from './components/MatchDetailModal.tsx';
import { SuggestionsView } from './components/SuggestionsView.tsx';
import { fetchGames, fetchSuggestions, triggerRefresh, updateSettings } from './services/api.ts';
import {
  ActiveScreenMode,
  IntensityLevel,
  LiveMatchData,
  LiveSuggestionItem,
  MinuteFilterOption,
  OddFilterOption,
  SortField,
  SuggestionsSummary,
  SystemSettings,
  TabType,
} from './types.ts';
import { AlertCircle, RefreshCw, Inbox, RotateCcw, Radio, Sparkles } from 'lucide-react';

export function App() {
  // Navigation Screens: LIVE MONITOR vs ENTRADAS SUGERIDAS
  const [activeScreenMode, setActiveScreenMode] = useState<ActiveScreenMode>('live_monitor');
  const [suggestions, setSuggestions] = useState<LiveSuggestionItem[]>([]);
  const [suggestionsSummary, setSuggestionsSummary] = useState<SuggestionsSummary>({
    total: 0,
    greens: 0,
    reds: 0,
    pending: 0,
    accuracyRate: 0,
  });
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // 1. Navigation (Section 1 & 2: As abas principais incluindo TODOS OS JOGOS)
  const [currentTab, setCurrentTab] = useState<TabType>('all');

  // 2. Filters State (Section 5-11, 16, 17: persistentes ao trocar de aba)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('ALL');
  const [selectedIntensity, setSelectedIntensity] = useState<IntensityLevel | 'ALL'>('ALL');
  const [onlyPreGoal, setOnlyPreGoal] = useState<boolean>(false);
  const [oddFilter, setOddFilter] = useState<OddFilterOption>('all');
  const [customOddMin, setCustomOddMin] = useState<number>(2.0);
  const [minuteFilter, setMinuteFilter] = useState<MinuteFilterOption>('auto');
  const [sortBy, setSortBy] = useState<SortField>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 3. Raw Data & Counts from Server
  const [rawMatches, setRawMatches] = useState<LiveMatchData[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    over_limite: 0,
    over_frente: 0,
    over_longa: 0,
  });
  const [settings, setSettings] = useState<SystemSettings>({
    pollIntervalSeconds: 60,
    isAutoRefreshActive: true,
    overLimiteRefOdd: 2.0,
    overFrenteRefOdd: 3.0,
    overLongaRefOdd: 3.0,
    lastPollTimestamp: null,
    activeProvider: 'ESPN Public API',
  });

  // 4. Modal states
  const [selectedMatch, setSelectedMatch] = useState<LiveMatchData | null>(null);

  // 5. Loading & Timer state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSuccessTime, setLastSuccessTime] = useState<string | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load suggestions from backend API
  const loadSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    try {
      const res = await fetchSuggestions();
      if (res && res.data) {
        setSuggestions(res.data);
        if (res.summary) {
          setSuggestionsSummary(res.summary);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar sugestões:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // Load matches & suggestions from backend API
  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const [resGames, resSug] = await Promise.allSettled([
        fetchGames({ tab: currentTab }),
        fetchSuggestions(),
      ]);

      if (resGames.status === 'fulfilled' && resGames.value.success) {
        const res = resGames.value;
        setRawMatches(res.data || []);
        setCounts({
          all: res.counts.all ?? (res.counts.over_limite || 0) + (res.counts.over_frente || 0) + (res.counts.over_longa || 0),
          over_limite: res.counts.over_limite || 0,
          over_frente: res.counts.over_frente || 0,
          over_longa: res.counts.over_longa || 0,
        });
        if (res.settings) {
          setSettings(res.settings);
        }
        setErrorMessage(null);
        setLastSuccessTime(new Date().toLocaleTimeString());
      } else if (resGames.status === 'rejected') {
        console.error('Erro ao buscar partidas:', resGames.reason);
        setErrorMessage('Falha ao conectar com o serviço de partidas ESPN.');
      }

      if (resSug.status === 'fulfilled' && resSug.value && resSug.value.data) {
        setSuggestions(resSug.value.data);
        if (resSug.value.summary) {
          setSuggestionsSummary(resSug.value.summary);
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar partidas e sugestões:', err);
      setErrorMessage('Falha ao conectar com o serviço de partidas ESPN.');
    } finally {
      setIsLoading(false);
      if (showSpinner) setIsRefreshing(false);
    }
  }, [currentTab]);

  // Initial load and reload on tab switch
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Periodic Auto-refresh Timer (Section 24)
  useEffect(() => {
    if (!settings.isAutoRefreshActive) return;

    setSecondsUntilRefresh(settings.pollIntervalSeconds || 60);

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          loadData();
          return settings.pollIntervalSeconds || 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [settings.isAutoRefreshActive, settings.pollIntervalSeconds, loadData]);

  // Manual Refresh Handler
  const handleRefreshNow = async () => {
    setIsRefreshing(true);
    try {
      await triggerRefresh();
      await loadData(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
      setSecondsUntilRefresh(settings.pollIntervalSeconds || 60);
    }
  };

  // Build dynamic list of active competitions in current tab (Section 6)
  const availableCompetitions = useMemo(() => {
    const compSet = new Set<string>();
    for (const m of rawMatches) {
      if ((currentTab === 'all' || m.tab === currentTab) && m.competitionName) {
        compSet.add(m.competitionName);
      }
    }
    return Array.from(compSet).sort();
  }, [rawMatches, currentTab]);

  // Reset filters handler
  const handleResetFilters = () => {
    setSelectedCompetition('ALL');
    setSelectedIntensity('ALL');
    setOnlyPreGoal(false);
  };

  // Calculate if any filters are active (Campeonatos, Intensidade ou Pré-Gol)
  const hasActiveFilters = useMemo(() => {
    return selectedCompetition !== 'ALL' || selectedIntensity !== 'ALL' || onlyPreGoal;
  }, [selectedCompetition, selectedIntensity, onlyPreGoal]);

  // Hot, Mega Hot and Pre-Goal counts based on current tab & competition
  const hotCounts = useMemo(() => {
    const base = currentTab === 'all' ? rawMatches : rawMatches.filter((m) => m.tab === currentTab);
    const compFiltered = selectedCompetition === 'ALL' ? base : base.filter((m) => m.competitionName === selectedCompetition);
    return {
      all: compFiltered.length,
      hot: compFiltered.filter((m) => m.intensity.primaryTag === 'HOT').length,
      mega_hot: compFiltered.filter((m) => m.intensity.primaryTag === 'MEGA_HOT').length,
    };
  }, [rawMatches, currentTab, selectedCompetition]);

  const preGoalCount = useMemo(() => {
    const base = currentTab === 'all' ? rawMatches : rawMatches.filter((m) => m.tab === currentTab);
    const compFiltered = selectedCompetition === 'ALL' ? base : base.filter((m) => m.competitionName === selectedCompetition);
    // Jogos com pressão e sem gol recente
    return compFiltered.filter((m) => !m.intensity.hasRecentGoal && (m.intensity.primaryTag === 'HOT' || m.intensity.primaryTag === 'MEGA_HOT')).length;
  }, [rawMatches, currentTab, selectedCompetition]);

  // Build active filter descriptions for Section 18
  const activeFilterDescriptions = useMemo(() => {
    const desc: string[] = [];
    if (selectedCompetition !== 'ALL') desc.push(selectedCompetition);
    if (selectedIntensity !== 'ALL') desc.push(selectedIntensity === 'MEGA_HOT' ? 'MEGA HOT' : 'HOT');
    if (onlyPreGoal) desc.push('Apenas Pré-Gol (sem gol recente)');
    return desc;
  }, [selectedCompetition, selectedIntensity, onlyPreGoal]);

  // Filter and sort matches strictly according to user selections
  const filteredAndSortedMatches = useMemo(() => {
    let result = currentTab === 'all' ? [...rawMatches] : rawMatches.filter((m) => m.tab === currentTab);

    // Dynamic Competition filter (Section 6)
    if (selectedCompetition !== 'ALL') {
      result = result.filter((m) => m.competitionName === selectedCompetition);
    }

    // Dynamic Intensity filter (HOT / MEGA_HOT)
    if (selectedIntensity !== 'ALL') {
      result = result.filter((m) => m.intensity.primaryTag === selectedIntensity);
    }

    // Dynamic Pre-Goal filter (Oculta jogos com gol recente / inflados por gol)
    if (onlyPreGoal) {
      result = result.filter((m) => !m.intensity.hasRecentGoal);
    }

    // Sorting (Section 11)
    const factor = sortOrder === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      if (sortBy === 'relevance') {
        // 1. Mega Hot, 2. Hot, 3. Demais jogos
        const rankMap: Record<IntensityLevel, number> = {
          MEGA_HOT: 3,
          HOT: 2,
          NORMAL: 1,
        };
        const rankA = rankMap[a.intensity.primaryTag] || 1;
        const rankB = rankMap[b.intensity.primaryTag] || 1;
        if (rankA !== rankB) {
          return (rankA - rankB) * factor;
        }

        // Maior xG recente primeiro
        const maxXgA = Math.max(a.intensity.xg10 || 0, a.intensity.xg15 || 0, a.intensity.xg5 || 0);
        const maxXgB = Math.max(b.intensity.xg10 || 0, b.intensity.xg15 || 0, b.intensity.xg5 || 0);
        return (maxXgA - maxXgB) * factor;
      }

      let valA = 0;
      let valB = 0;

      switch (sortBy) {
        case 'minute':
          valA = a.minute;
          valB = b.minute;
          break;
        case 'odd':
          valA = a.targetOver.foundOdd || 0;
          valB = b.targetOver.foundOdd || 0;
          break;
        case 'xg15':
          valA = a.intensity.xg15 || 0;
          valB = b.intensity.xg15 || 0;
          break;
        case 'xg10':
          valA = a.intensity.xg10 || 0;
          valB = b.intensity.xg10 || 0;
          break;
        case 'xg5':
          valA = a.intensity.xg5 || 0;
          valB = b.intensity.xg5 || 0;
          break;
        case 'shotsOnTarget':
          valA = a.recent10?.shotsOnTarget || 0;
          valB = b.recent10?.shotsOnTarget || 0;
          break;
        case 'bigChances':
          valA = a.recent10?.bigChances || 0;
          valB = b.recent10?.bigChances || 0;
          break;
      }

      return (valA - valB) * factor;
    });

    return result;
  }, [
    rawMatches,
    currentTab,
    searchQuery,
    selectedCompetition,
    selectedIntensity,
    oddFilter,
    customOddMin,
    minuteFilter,
    sortBy,
    sortOrder,
  ]);

  // Group filtered matches by competition (Section 12)
  const groupedMatches = useMemo(() => {
    const groups: { competitionName: string; matches: LiveMatchData[] }[] = [];
    const map = new Map<string, LiveMatchData[]>();

    for (const match of filteredAndSortedMatches) {
      const comp = match.competitionName || 'Outras Ligas';
      if (!map.has(comp)) {
        map.set(comp, []);
      }
      map.get(comp)!.push(match);
    }

    map.forEach((matches, compName) => {
      groups.push({
        competitionName: compName,
        matches,
      });
    });

    // Sort competition groups by count of matches descending
    groups.sort((a, b) => b.matches.length - a.matches.length);

    return groups;
  }, [filteredAndSortedMatches]);


  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 1. BARRA SUPERIOR */}
      <Header
        settings={settings}
        secondsUntilRefresh={secondsUntilRefresh}
        isRefreshing={isRefreshing}
        apiStatus={errorMessage ? 'offline' : rawMatches.length > 0 ? 'live' : 'no_data'}
        lastSuccessTime={lastSuccessTime}
        onRefreshNow={handleRefreshNow}
      />

      {/* Imagem Divertida de Fundo (Tema Futebol e Gol) preenchendo o espaço do Main */}
      <div className="fixed inset-0 top-[65px] pointer-events-none z-0 overflow-hidden">
        <img
          src="/fun_soccer_goal_bg.jpg"
          alt="Fundo divertido de futebol e gol"
          className="w-full h-full object-cover object-center opacity-25"
          loading="eager"
        />
        {/* Camadas de gradiente para manter legibilidade impecável dos dados */}
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950/90" />
      </div>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl 2xl:max-w-[1536px] w-full mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4">
        {/* Error message if disconnected */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-2xl flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={handleRefreshNow}
              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-xl border border-rose-500/40 text-[11px] cursor-pointer transition-colors"
            >
              Tentar reconectar
            </button>
          </div>
        )}

        {/* SELETOR DE TELAS: LIVE MONITOR vs ENTRADAS SUGERIDAS */}
        <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl p-1.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto sm:min-w-[460px]">
            {/* TELA 1: LIVE MONITOR */}
            <button
              id="screen-btn-live-monitor"
              type="button"
              role="tab"
              aria-selected={activeScreenMode === 'live_monitor'}
              onClick={() => setActiveScreenMode('live_monitor')}
              className={`px-4 py-2.5 rounded-xl font-sans font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 border select-none ${
                activeScreenMode === 'live_monitor'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                  : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
              }`}
            >
              <Radio
                className={`w-4 h-4 shrink-0 ${
                  activeScreenMode === 'live_monitor' ? 'text-slate-950 animate-pulse' : 'text-emerald-400'
                }`}
              />
              <span className="whitespace-nowrap">LIVE MONITOR</span>
              <span
                className={`text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                  activeScreenMode === 'live_monitor'
                    ? 'bg-slate-950/20 text-slate-950 border-slate-950/30'
                    : 'bg-slate-900 text-slate-300 border-slate-750'
                }`}
              >
                {counts.all}
              </span>
            </button>

            {/* TELA 2: ENTRADAS SUGERIDAS */}
            <button
              id="screen-btn-suggestions"
              type="button"
              role="tab"
              aria-selected={activeScreenMode === 'suggestions'}
              onClick={() => setActiveScreenMode('suggestions')}
              className={`px-4 py-2.5 rounded-xl font-sans font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 border select-none ${
                activeScreenMode === 'suggestions'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/40'
                  : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
              }`}
            >
              <Sparkles
                className={`w-4 h-4 shrink-0 ${
                  activeScreenMode === 'suggestions' ? 'text-slate-950' : 'text-amber-400'
                }`}
              />
              <span className="whitespace-nowrap">ENTRADAS SUGERIDAS</span>
              <span
                className={`text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                  activeScreenMode === 'suggestions'
                    ? 'bg-slate-950/20 text-slate-950 border-slate-950/30'
                    : 'bg-slate-900 text-amber-300 border-slate-750'
                }`}
              >
                {suggestionsSummary.total}
              </span>
              {suggestionsSummary.greens > 0 && (
                <span
                  className={`hidden sm:inline-flex text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                    activeScreenMode === 'suggestions'
                      ? 'bg-slate-950/30 text-slate-950'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {suggestionsSummary.accuracyRate}% Green
                </span>
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center text-[11px] font-mono text-slate-400 px-2 gap-2">
            <span>
              {activeScreenMode === 'live_monitor'
                ? 'Visualizando monitor em tempo real'
                : 'Sugestões automáticas baseadas em xG e pressão'}
            </span>
          </div>
        </div>

        {/* RENDERIZAÇÃO CONDICIONAL DA TELA SELECIONADA */}
        {activeScreenMode === 'live_monitor' ? (
          <>
            {/* 2. ABAS PRINCIPAIS (TODOS OS JOGOS, OVER LIMITE, OVER À FRENTE, OVER LONGA) */}
            <MainTabs
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setCurrentTab(tab);
              }}
              counts={counts}
            />

            {/* 3. FILTROS DE INTENSIDADE (HOT E MEGA HOT), PRÉ-GOL E CAMPEONATOS */}
            <FilterBar
              availableCompetitions={availableCompetitions}
              selectedCompetition={selectedCompetition}
              onSelectCompetition={setSelectedCompetition}
              selectedIntensity={selectedIntensity}
              onSelectIntensity={setSelectedIntensity}
              onlyPreGoal={onlyPreGoal}
              onTogglePreGoal={() => setOnlyPreGoal((prev) => !prev)}
              preGoalCount={preGoalCount}
              hotCounts={hotCounts}
              onResetFilters={handleResetFilters}
              hasActiveFilters={hasActiveFilters}
            />

            {/* 5. LISTA DE PARTIDAS AGRUPADA POR CAMPEONATO */}
            <div id="matches-section" className="space-y-6 pt-2">
              {isLoading && rawMatches.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Conectando e processando partidas ao vivo da ESPN...</span>
                </div>
              ) : groupedMatches.length > 0 ? (
                groupedMatches.map((group) => (
                  <CompetitionGroup
                    key={group.competitionName}
                    competitionName={group.competitionName}
                    matches={group.matches}
                    currentTab={currentTab}
                    onOpenDetailModal={(m) => setSelectedMatch(m)}
                  />
                ))
              ) : (
                /* SEM DADOS */
                <div
                  id="empty-state"
                  className="py-16 px-4 bg-slate-900/60 border border-slate-800 rounded-3xl text-center font-mono flex flex-col items-center justify-center space-y-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-200">Nenhum jogo encontrado</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {hasActiveFilters
                        ? 'Não há partidas que correspondam aos filtros selecionados.'
                        : currentTab === 'all'
                        ? 'Não há partidas ao vivo em andamento no momento.'
                        : `Não há partidas em andamento nesta janela temporal (${
                            currentTab === 'over_limite'
                              ? '> 75\''
                              : currentTab === 'over_frente'
                              ? '> 60\' até 75\''
                              : '25\' até 45\''
                          }) no momento.`}
                    </p>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={handleResetFilters}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Limpar Filtros</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <SuggestionsView
            suggestions={suggestions}
            summary={suggestionsSummary}
            isLoading={isLoadingSuggestions}
            onRefresh={loadSuggestions}
          />
        )}
      </main>

      {/* Footer Disclaimer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-3 text-center text-[11px] font-mono text-slate-400 px-4">
        ODDCERTA Live Monitor • Monitoramento analítico em tempo real • Sem recomendações automáticas de aposta • Fonte ESPN Pública
      </footer>

      {/* Modal de Detalhes da Partida */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}

export default App;
