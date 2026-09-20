import {
  CompetitionConfig,
  LiveMatchData,
  LiveSuggestionItem,
  MatchHistoricalProbability,
  SuggestionCriteriaConfig,
  SuggestionsSummary,
  SystemSettings,
} from '../types.ts';
import { clientGamesService } from './clientGames.ts';

export interface GamesApiResponse {
  success: boolean;
  data: LiveMatchData[];
  counts: {
    all: number;
    over_limite: number;
    over_frente: number;
    over_longa: number;
    mega_hot: number;
    hot: number;
  };
  settings: SystemSettings;
}

// Automatically detect if running on GitHub Pages or static host without Express backend
let isStandalone = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

export async function fetchGames(params?: {
  tab?: string;
  intensity?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<GamesApiResponse> {
  if (!isStandalone) {
    try {
      const query = new URLSearchParams();
      if (params?.tab && params.tab !== 'all') query.set('tab', params.tab);
      if (params?.intensity && params.intensity !== 'ALL') query.set('intensity', params.intensity);
      if (params?.sortBy) query.set('sortBy', params.sortBy);
      if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

      const res = await fetch(`/api/games?${query.toString()}`);
      if (res.ok) {
        return await res.json();
      }
      if (res.status === 404) {
        console.warn('[API] /api/games retornou 404. Ativando modo client-side (ESPN direto).');
        isStandalone = true;
      }
    } catch (err) {
      console.warn('[API] Servidor local indisponível. Ativando modo client-side.', err);
      isStandalone = true;
    }
  }

  return await clientGamesService.getGames(params);
}

export async function fetchGameDetail(id: string): Promise<LiveMatchData> {
  if (!isStandalone) {
    try {
      const res = await fetch(`/api/games/${id}`);
      if (res.ok) {
        const data = await res.json();
        return data.data;
      }
    } catch {
      isStandalone = true;
    }
  }
  return await clientGamesService.getGameDetail(id);
}

export async function triggerRefresh(): Promise<number> {
  if (!isStandalone) {
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        return data.count;
      }
    } catch {
      isStandalone = true;
    }
  }
  const list = await clientGamesService.pollMatches();
  return list.length;
}

export async function fetchCompetitions(): Promise<CompetitionConfig[]> {
  if (!isStandalone) {
    try {
      const res = await fetch('/api/competitions');
      if (res.ok) {
        const data = await res.json();
        return data.data;
      }
    } catch {
      isStandalone = true;
    }
  }
  return await clientGamesService.getCompetitions();
}

export async function toggleCompetition(id: string, isActive: boolean): Promise<void> {
  if (!isStandalone) {
    try {
      const res = await fetch(`/api/competitions/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) return;
    } catch {
      isStandalone = true;
    }
  }
  await clientGamesService.toggleCompetition(id, isActive);
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  if (!isStandalone) {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        return data.data;
      }
    } catch {
      isStandalone = true;
    }
  }
  return clientGamesService.updateSettings(settings);
}

export async function fetchInspection(): Promise<any> {
  if (!isStandalone) {
    try {
      const res = await fetch('/api/system/inspection');
      if (res.ok) {
        const data = await res.json();
        return data.data;
      }
    } catch {
      // ignore
    }
  }
  return {
    database: 'In-Memory Client Provider',
    matchesCount: (await clientGamesService.getGames()).data.length,
    activeProvider: 'ESPN Public API',
  };
}

export async function fetchGameHistory(id: string, line?: number): Promise<MatchHistoricalProbability> {
  if (!isStandalone) {
    try {
      const query = line !== undefined ? `?line=${line}` : '';
      const res = await fetch(`/api/games/${id}/history${query}`);
      if (res.ok) {
        const data = await res.json();
        return data.data;
      }
    } catch {
      isStandalone = true;
    }
  }
  return await clientGamesService.getGameHistory(id, line);
}

export async function fetchSuggestions(params?: {
  status?: string;
  type?: string;
}): Promise<{ data: LiveSuggestionItem[]; summary: SuggestionsSummary }> {
  if (!isStandalone) {
    try {
      const query = new URLSearchParams();
      if (params?.status && params.status !== 'ALL') query.set('status', params.status);
      if (params?.type && params.type !== 'ALL') query.set('type', params.type);

      const res = await fetch(`/api/suggestions?${query.toString()}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      isStandalone = true;
    }
  }
  return clientGamesService.getSuggestions(params);
}

export async function fetchSuggestionCriteria(): Promise<SuggestionCriteriaConfig> {
  if (!isStandalone) {
    try {
      const res = await fetch('/api/suggestions/criteria');
      if (res.ok) {
        const data = await res.json();
        return data.data;
      }
    } catch {
      isStandalone = true;
    }
  }
  return clientGamesService.getCriteria();
}

export async function updateSuggestionCriteria(
  config: Partial<SuggestionCriteriaConfig>
): Promise<SuggestionCriteriaConfig> {
  if (!isStandalone) {
    try {
      const res = await fetch('/api/suggestions/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const data = await res.json();
        return data.data;
      }
    } catch {
      isStandalone = true;
    }
  }
  return clientGamesService.updateCriteria(config);
}
