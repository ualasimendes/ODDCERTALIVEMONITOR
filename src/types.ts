export type TabType = 'all' | 'over_limite' | 'over_frente' | 'over_longa';
export type IntensityLevel = 'MEGA_HOT' | 'HOT' | 'NORMAL';

export type SortField =
  | 'relevance'
  | 'minute'
  | 'odd'
  | 'xg15'
  | 'xg10'
  | 'xg5'
  | 'shotsOnTarget'
  | 'bigChances';

export type MinuteFilterOption =
  | 'auto'
  | '25-30'
  | '30-35'
  | '35-40'
  | '40-45'
  | '60-65'
  | '65-70'
  | '70-75'
  | '75-80'
  | '80-85'
  | '85-90';

export type OddFilterOption = 'all' | '2.0' | '2.5' | '3.0' | '4.0' | '5.0' | 'custom';

export interface CompetitionConfig {
  id: string;
  name: string;
  country: string;
  slug: string;
  isActive: boolean;
}

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logoUrl?: string;
}

export interface MatchStatsAccumulated {
  xg: number | null;
  totalShots: number | null;
  shotsOnTarget: number | null;
  shotsOffTarget: number | null;
  shotsInsideBox: number | null;
  bigChances: number | null;
  corners: number | null;
  possession: number | null;
}

export interface MatchRecentStats {
  xg: number | null;
  totalShots: number | null;
  shotsOnTarget: number | null;
  shotsOffTarget: number | null;
  shotsInsideBox: number | null;
  bigChances: number | null;
}

export interface TeamStats {
  xg: number | null;
  totalShots: number | null;
  shotsOnTarget: number | null;
  shotsOffTarget: number | null;
  blockedShots: number | null;
  shotsInsideBox: number | null;
  shotsOutsideBox: number | null;
  bigChances: number | null;
  corners: number | null;
  possession: number | null;
  passes: number | null;
  passAccuracy: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  offsides: number | null;
  attacks: number | null;
  dangerousAttacks: number | null;
}

export interface TeamRecentStats {
  xg: number | null;
  totalShots: number | null;
  shotsOnTarget: number | null;
  shotsOffTarget: number | null;
  shotsInsideBox: number | null;
  shotsOutsideBox?: number | null;
  blockedShots?: number | null;
  bigChances: number | null;
  corners?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
  goals?: number | null;
  fouls?: number | null;
}

export interface IntensityBreakdown {
  xg15: number | null;
  tag15: IntensityLevel;
  xg10: number | null;
  tag10: IntensityLevel;
  xg5: number | null;
  tag5: IntensityLevel;
  primaryTag: IntensityLevel;
  historicalOverRate?: number | null;
  confluenceReason?: string;
}

export interface OverMarketTarget {
  tab: TabType;
  targetLine: number;
  referenceOdd: number;
  foundOdd: number | null;
  isAboveReference: boolean;
  providerName?: string;
  marketDescription: string;
}

export interface GameSnapshot {
  id?: number;
  gameId: string;
  timestamp: string;
  minute: number;
  homeScore: number;
  awayScore: number;
  homeXg: number | null;
  awayXg: number | null;
  totalXg: number | null;
  homeShots: number | null;
  awayShots: number | null;
  homeShotsOnTarget: number | null;
  awayShotsOnTarget: number | null;
  homeShotsOffTarget: number | null;
  awayShotsOffTarget: number | null;
  homeShotsInsideBox: number | null;
  awayShotsInsideBox: number | null;
  homeBigChances: number | null;
  awayBigChances: number | null;
}

export interface GoalDistribution {
  goals0: number;
  goals1: number;
  goals2: number;
  goals3: number;
  goals4: number;
  goals5Plus: number;
}

export interface LineRateItem {
  line: number;
  hits: number;
  total: number;
  ratePercent: number;
}

export interface TeamAuditMatchItem {
  matchId: string;
  date: string;
  rawDate?: string;
  isHome: boolean;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
  totalGoals: number;
  isOverTarget: boolean;
}

export interface MatchEventItem {
  id: string;
  minute: number;
  timeDisplay: string;
  type: 'goal' | 'yellow-card' | 'red-card' | 'substitution' | 'penalty' | 'var' | 'other';
  text: string;
  shortText?: string;
  teamId?: string;
  teamName?: string;
  isHome?: boolean;
}

export interface TeamHistoricalPerformance {
  teamId: string;
  teamName: string;
  totalGamesAnalyzed: number;
  overTargetHits: number;
  overTargetMisses: number;
  overTargetRatePercent: number;
  venue: 'home' | 'away';
  venueGamesAnalyzed: number;
  venueOverHits: number;
  venueOverMisses: number;
  venueOverRatePercent: number | null;
  goalDistribution: GoalDistribution;
  ratesByLine: LineRateItem[];
  auditMatches?: TeamAuditMatchItem[];
}

export interface MatchHistoricalProbability {
  competitionId: string;
  competitionName: string;
  seasonYear?: number;
  targetLine: number;
  targetDescription: string;
  isAvailable: boolean;
  statusMessage?: string;
  home: TeamHistoricalPerformance | null;
  away: TeamHistoricalPerformance | null;
  historicalEstimatePercent: number | null;
  methodologyDescription: string;
  sampleSizeTotalGames: number;
  isReducedSample: boolean;
}

export interface LiveMatchData {
  id: string;
  competitionId: string;
  competitionName: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  homeScore: number;
  awayScore: number;
  totalScore: number;
  minute: number;
  displayClock: string;
  statusState: 'in' | 'pre' | 'post';
  statusDetail: string;
  tab: TabType | 'out_of_window';
  targetOver: OverMarketTarget;
  intensity: IntensityBreakdown;
  homeStats: TeamStats;
  awayStats: TeamStats;
  recent5Home?: TeamRecentStats;
  recent5Away?: TeamRecentStats;
  recent10Home?: TeamRecentStats;
  recent10Away?: TeamRecentStats;
  recent15Home?: TeamRecentStats;
  recent15Away?: TeamRecentStats;
  accumulated: MatchStatsAccumulated;
  recent10: MatchRecentStats;
  recent15?: MatchRecentStats;
  recent5?: MatchRecentStats;
  snapshotsCount: number;
  snapshots: GameSnapshot[];
  history?: MatchHistoricalProbability;
  events?: MatchEventItem[];
  lastUpdated: string;
}

export interface SystemSettings {
  pollIntervalSeconds: number;
  isAutoRefreshActive: boolean;
  overLimiteRefOdd: number;
  overFrenteRefOdd: number;
  overLongaRefOdd: number;
  lastPollTimestamp: string | null;
  activeProvider: string;
}

export type ActiveScreenMode = 'live_monitor' | 'suggestions';

export type SuggestionType = 'UNILATERAL_HOME' | 'UNILATERAL_AWAY' | 'OVER_OPEN_GAME';
export type SuggestionStatus = 'PENDENTE' | 'GREEN' | 'RED';

export interface LiveSuggestionItem {
  id: string;
  gameId: string;
  competitionName: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  minute: number;
  scoreAtTime: {
    home: number;
    away: number;
  };
  currentScore: {
    home: number;
    away: number;
  };
  type: SuggestionType;
  typeLabel: string;
  dominantTeam?: 'home' | 'away';
  dominantTeamName?: string;
  targetLine?: number;
  odd?: number | null;
  marketDescription: string;
  suggestionText: string;
  triggerReason?: string;
  xgDiff?: number;
  status: SuggestionStatus;
  resultNote?: string;
  resolvedAtMinute?: number;
  createdAt: string;
  resolvedAt?: string;
  metrics: {
    homeXg15: number | null;
    awayXg15: number | null;
    homeXg10: number | null;
    awayXg10: number | null;
    homeXg5: number | null;
    awayXg5: number | null;
    totalXg: number | null;
    recentShotsHome?: number | null;
    recentShotsAway?: number | null;
    recentSotHome?: number | null;
    recentSotAway?: number | null;
  };
}

export interface SuggestionsSummary {
  total: number;
  greens: number;
  reds: number;
  pending: number;
  accuracyRate: number;
}

export interface SuggestionCriteriaConfig {
  // Padrão 1: Pressão Unilateral
  unilateralMinXgDiff: number; // Ex: 0.20 (XG A - XG B >= 0.20)
  unilateralMinDominantXg: number;
  unilateralMaxOpponentXg: number; // Ex: 0.00 (XG B = 0)
  unilateralDominanceRatio: number;
  unilateralMinDominantShots: number;
  unilateralMinDominantSot: number;

  // Padrão 2: Jogo Aberto (Lá e Cá)
  openGameMinMutualXg: number;
  openGameMinCombinedXg: number;
  openGameMinCombinedShots: number;

  // Filtros Globais da Partida
  minMinute: number;
  maxMinute: number;
  minOddValue: number;
}
