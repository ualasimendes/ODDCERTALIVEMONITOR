import { CompetitionConfig, LiveMatchData, MatchHistoricalProbability, SystemSettings } from '../types.ts';

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

export async function fetchGames(params?: {
  tab?: string;
  intensity?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<GamesApiResponse> {
  const query = new URLSearchParams();
  if (params?.tab && params.tab !== 'all') query.set('tab', params.tab);
  if (params?.intensity && params.intensity !== 'ALL') query.set('intensity', params.intensity);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await fetch(`/api/games?${query.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchGameDetail(id: string): Promise<LiveMatchData> {
  const res = await fetch(`/api/games/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.data;
}

export async function triggerRefresh(): Promise<number> {
  const res = await fetch('/api/refresh', { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.count;
}

export async function fetchCompetitions(): Promise<CompetitionConfig[]> {
  const res = await fetch('/api/competitions');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.data;
}

export async function toggleCompetition(id: string, isActive: boolean): Promise<void> {
  await fetch(`/api/competitions/${id}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.data;
}

export async function fetchInspection(): Promise<any> {
  const res = await fetch('/api/system/inspection');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.data;
}

export async function fetchGameHistory(id: string, line?: number): Promise<MatchHistoricalProbability> {
  const query = line !== undefined ? `?line=${line}` : '';
  const res = await fetch(`/api/games/${id}/history${query}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.data;
}
