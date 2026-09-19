import { CompetitionConfig } from '../models/types.ts';
import { RawMatchSummary, SoccerDataProvider } from './types.ts';

/**
 * Public Market / Betfair Scraper Reference Provider
 * Conforms to SoccerDataProvider interface.
 * Implements public market reading without any betting account login,
 * credentials, or automated placement.
 */
export class BetfairPublicProvider implements SoccerDataProvider {
  public readonly name = 'Betfair Public Market Reference';

  public async getCompetitions(): Promise<CompetitionConfig[]> {
    return [
      { id: 'premier-league', name: 'Premier League', slug: 'pl', country: 'Inglaterra', isActive: true },
      { id: 'la-liga', name: 'La Liga', slug: 'laliga', country: 'Espanha', isActive: true },
      { id: 'serie-a', name: 'Serie A', slug: 'serie-a', country: 'Itália', isActive: true },
      { id: 'brasileirao', name: 'Brasileirão Série A', slug: 'brasileirao', country: 'Brasil', isActive: true },
    ];
  }

  public async getLiveMatches(competitionIds: string[]): Promise<RawMatchSummary[]> {
    // Modular adapter interface ready for pluggable public exchange scraping feed
    return [];
  }

  public async getMatchDetail(matchId: string, competitionId: string): Promise<RawMatchSummary | null> {
    return null;
  }
}
