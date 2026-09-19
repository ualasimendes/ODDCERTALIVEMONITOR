import { CompetitionConfig, MatchEventItem } from '../models/types.ts';

export interface RawCompetitor {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  score: number;
  homeAway: 'home' | 'away';
  logoUrl?: string;
}

export interface RawOddItem {
  providerName: string;
  market: string;
  line: number;
  overOddsDecimal: number | null;
  underOddsDecimal: number | null;
  isLive: boolean;
}

export interface RawMatchSummary {
  id: string;
  competitionId: string;
  competitionName: string;
  homeTeam: RawCompetitor;
  awayTeam: RawCompetitor;
  minute: number;
  displayClock: string;
  state: 'in' | 'pre' | 'post';
  statusDetail: string;
  homeXg: number | null;
  awayXg: number | null;
  totalXg: number | null;
  boxscoreStats: {
    home: { [statKey: string]: number };
    away: { [statKey: string]: number };
  };
  commentaryPlays: Array<{
    timeDisplay: string;
    minute: number;
    text: string;
    type?: string;
  }>;
  events?: MatchEventItem[];
  oddsList: RawOddItem[];
}

export interface SoccerDataProvider {
  readonly name: string;
  getCompetitions(): Promise<CompetitionConfig[]>;
  getLiveMatches(competitionIds: string[]): Promise<RawMatchSummary[]>;
  getMatchDetail(matchId: string, competitionId: string): Promise<RawMatchSummary | null>;
}
