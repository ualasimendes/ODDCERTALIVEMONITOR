import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Header } from './components/Header.tsx';
import { MainTabs } from './components/MainTabs.tsx';
import { TabSummary } from './components/TabSummary.tsx';
import { FilterBar } from './components/FilterBar.tsx';
import { CompetitionGroup } from './components/CompetitionGroup.tsx';
import { MatchDetailModal } from './components/MatchDetailModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { DiagnosticsModal } from './components/DiagnosticsModal.tsx';
import { fetchGames, triggerRefresh, updateSettings } from './services/api.ts';
import {
  IntensityLevel,
  LiveMatchData,
  MinuteFilterOption,
  OddFilterOption,
  SortField,
  SystemSettings,
  TabType,
} from './types.ts';
import { ShieldAlert, AlertCircle, RefreshCw, Inbox, RotateCcw } from 'lucide-react';

export function App() {
  // 1. Navigation (Section 1 & 2: As 3 abas principais)
  const [currentTab, setCurrentTab] = useState<TabType>('over_limite');

  // 2. Filters State (Section 5-11, 16, 17: persistentes ao trocar de aba)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('ALL');
  const [selectedIntensity, setSelectedIntensity] = useState<IntensityLevel | 'ALL'>('ALL');
  const [oddFilter, setOddFilter] = useState<OddFilterOption>('all');
  const [customOddMin, setCustomOddMin] = useState<number>(2.0);
  const [minuteFilter, setMinuteFilter] = useState<MinuteFilterOption>('auto');
  const [sortBy, setSortBy] = useState<SortField>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 3. Raw Data & Counts from Server
  const [rawMatches, setRawMatches] = useState<LiveMatchData[]>([]);
  const [counts, setCounts] = useState({
    over_limite: 0,
    over_frente: 0,
    over_longa: 0,
  });
  const [settings, setSettings] = useState<SystemSettings>({
    pollIntervalSeconds: 30,
    isAutoRefreshActive: true,
    overLimiteRefOdd: 2.0,
    overFrenteRefOdd: 3.0,
    overLongaRefOdd: 3.0,
    lastPollTimestamp: null,
    activeProvider: 'ESPN Public API',
  });

  // 4. Modal states
  const [selectedMatch, setSelectedMatch] = useState<LiveMatchData | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  // 5. Loading & Timer state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSuccessTime, setLastSuccessTime] = useState<string | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load matches from backend API
  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      // Fetch all matches or tab matches
      const res = await fetchGames({
        tab: currentTab,
      });

      if (res.success) {
        setRawMatches(res.data || []);
        setCounts({
          over_limite: res.counts.over_limite || 0,
          over_frente: res.counts.over_frente || 0,
          over_longa: res.counts.over_longa || 0,
        });
        if (res.settings) {
          setSettings(res.settings);
        }
        setErrorMessage(null);
        setLastSuccessTime(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      console.error('Erro ao buscar partidas:', err);
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

    setSecondsUntilRefresh(settings.pollIntervalSeconds || 30);

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          loadData();
          return settings.pollIntervalSeconds || 30;
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
      setSecondsUntilRefresh(settings.pollIntervalSeconds || 30);
    }
  };

  // Build dynamic list of active competitions in current tab (Section 6)
  const availableCompetitions = useMemo(() => {
    const compSet = new Set<string>();
    for (const m of rawMatches) {
      if (m.tab === currentTab && m.competitionName) {
        compSet.add(m.competitionName);
      }
    }
    return Array.from(compSet).sort();
  }, [rawMatches, currentTab]);

  // Reset filters handler
  const handleResetFilters = () => {
    setSelectedCompetition('ALL');
  };

  // Calculate if any filters are active (Somente Campeonatos)
  const hasActiveFilters = useMemo(() => {
    return selectedCompetition !== 'ALL';
  }, [selectedCompetition]);

  // Build active filter descriptions for Section 18
  const activeFilterDescriptions = useMemo(() => {
    const desc: string[] = [];
    if (selectedCompetition !== 'ALL') desc.push(selectedCompetition);
    return desc;
  }, [selectedCompetition]);

  // Filter and sort matches strictly according to user selections
  const filteredAndSortedMatches = useMemo(() => {
    let result = rawMatches.filter((m) => m.tab === currentTab);

    // Dynamic Competition filter (Section 6)
    if (selectedCompetition !== 'ALL') {
      result = result.filter((m) => m.competitionName === selectedCompetition);
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

  // Tab stats for the summary panel (Section 4)
  const tabRawMatches = useMemo(() => {
    return rawMatches.filter((m) => m.tab === currentTab);
  }, [rawMatches, currentTab]);

  const hotCount = useMemo(() => {
    return tabRawMatches.filter((m) => m.intensity.primaryTag === 'HOT').length;
  }, [tabRawMatches]);

  const megaHotCount = useMemo(() => {
    return tabRawMatches.filter((m) => m.intensity.primaryTag === 'MEGA_HOT').length;
  }, [tabRawMatches]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 1. BARRA SUPERIOR (Section 1 & 24) */}
      <Header
        settings={settings}
        secondsUntilRefresh={secondsUntilRefresh}
        isRefreshing={isRefreshing}
        apiStatus={errorMessage ? 'offline' : rawMatches.length > 0 ? 'live' : 'no_data'}
        lastSuccessTime={lastSuccessTime}
        onRefreshNow={handleRefreshNow}
        onToggleAutoRefresh={() => {
          const updated = !settings.isAutoRefreshActive;
          setSettings((s) => ({ ...s, isAutoRefreshActive: updated }));
          updateSettings({ isAutoRefreshActive: updated });
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Error message if disconnected */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={handleRefreshNow}
              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded border border-rose-500/40 text-[11px] cursor-pointer"
            >
              Tentar reconectar
            </button>
          </div>
        )}

        {/* 2. ABAS PRINCIPAIS (Section 1 & 2: OVER LIMITE, OVER À FRENTE, OVER LONGA) */}
        <MainTabs
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            // Notice: Section 17: "Ao trocar de aba: os filtros devem permanecer."
          }}
          counts={counts}
        />

        {/* 3. RESUMO DOS JOGOS (Section 1 & 4: Painel de Resumo da Aba) */}
        <TabSummary
          currentTab={currentTab}
          totalInTab={tabRawMatches.length}
          filteredCount={filteredAndSortedMatches.length}
          hotCount={hotCount}
          megaHotCount={megaHotCount}
          lastUpdated={lastSuccessTime}
          activeFilterDescriptions={activeFilterDescriptions}
          onClearFilters={handleResetFilters}
        />

        {/* 4. FILTRO DE CAMPEONATOS (Opções lateralizadas com clique direto) */}
        <FilterBar
          availableCompetitions={availableCompetitions}
          selectedCompetition={selectedCompetition}
          onSelectCompetition={setSelectedCompetition}
          onResetFilters={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* 5. LISTA DE PARTIDAS AGRUPADA POR CAMPEONATO (Section 1, 12, 13, 19) */}
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
                onOpenDetailModal={(m) => setSelectedMatch(m)}
              />
            ))
          ) : (
            /* Section 19: SEM DADOS */
            <div
              id="empty-state"
              className="py-16 px-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-center font-mono flex flex-col items-center justify-center space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-200">Nenhum jogo encontrado</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {hasActiveFilters
                    ? 'Não há partidas que correspondam aos filtros atuais nesta janela.'
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
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-semibold cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar Filtros</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-3 text-center text-[11px] font-mono text-slate-400 px-4">
        ODDCERTA Live Monitor • Monitoramento analítico em tempo real • Sem recomendações automáticas de aposta • Fonte ESPN Pública
      </footer>

      {/* Modais */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings}
        onSettingsUpdated={(newSettings: SystemSettings) => {
          setSettings(newSettings);
          setIsSettingsOpen(false);
          loadData(true);
        }}
      />

      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </div>
  );
}

export default App;
