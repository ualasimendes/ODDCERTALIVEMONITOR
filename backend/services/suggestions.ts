import { dbService } from '../database/db.ts';
import { LiveMatchData, LiveSuggestionItem, SuggestionCriteriaConfig, SuggestionStatus, SuggestionsSummary, SuggestionType } from '../models/types.ts';
import { RawMatchSummary } from '../providers/types.ts';

export const DEFAULT_SUGGESTION_CRITERIA: SuggestionCriteriaConfig = {
  // Padrão 1: Pressão Unilateral (Ex: xG A - xG B >= 0.20 AND xG B = 0.00)
  unilateralMinXgDiff: 0.20,
  unilateralMinDominantXg: 0.20,
  unilateralMaxOpponentXg: 0.00,
  unilateralDominanceRatio: 2.5,
  unilateralMinDominantShots: 2,
  unilateralMinDominantSot: 1,

  // Padrão 2: Lá e Cá (Jogo Aberto)
  openGameMinMutualXg: 0.04,
  openGameMinCombinedXg: 0.12,
  openGameMinCombinedShots: 3,

  // Filtros Globais
  minMinute: 10,
  maxMinute: 88,
  minOddValue: 1.25,
};

export class SuggestionsService {
  private suggestions: Map<string, LiveSuggestionItem> = new Map();
  private criteria: SuggestionCriteriaConfig = { ...DEFAULT_SUGGESTION_CRITERIA };
  private isLoadedFromDb = false;

  constructor() {
    this.loadFromDb();
  }

  public getCriteria(): SuggestionCriteriaConfig {
    return { ...this.criteria };
  }

  public updateCriteria(partial: Partial<SuggestionCriteriaConfig>): SuggestionCriteriaConfig {
    const clean: any = { ...partial };

    // Normalização inteligente: se o usuário fornecer 20 para um limiar de xG, converte para 0.20
    const xgFields: (keyof SuggestionCriteriaConfig)[] = [
      'unilateralMinXgDiff',
      'unilateralMinDominantXg',
      'unilateralMaxOpponentXg',
      'openGameMinMutualXg',
      'openGameMinCombinedXg',
    ];

    for (const field of xgFields) {
      if (clean[field] !== undefined) {
        const val = Number(clean[field]);
        if (!isNaN(val)) {
          clean[field] = val > 1.0 ? parseFloat((val / 100).toFixed(2)) : parseFloat(val.toFixed(2));
        }
      }
    }

    this.criteria = { ...this.criteria, ...clean };
    return { ...this.criteria };
  }

  private loadFromDb() {
    if (this.isLoadedFromDb) return;
    try {
      const items = dbService.getAllSuggestions();
      for (const item of items) {
        this.suggestions.set(item.id, item);
      }
      this.isLoadedFromDb = true;
    } catch (err) {
      console.error('[SuggestionsService] Error loading from DB:', err);
    }
  }

  /**
   * Evaluates all in-play matches to detect new suggestions
   * and audits active pending suggestions against real match events/goals.
   */
  public evaluateMatches(liveMatches: LiveMatchData[], rawMatches?: RawMatchSummary[]) {
    this.loadFromDb();
    const nowIso = new Date().toISOString();

    // 1. Detect new entry suggestions for in-play matches
    for (const match of liveMatches) {
      if (match.statusState !== 'in') continue;
      if (match.minute < this.criteria.minMinute || match.minute > this.criteria.maxMinute) continue;

      let h15 = match.recent15Home?.xg ?? 0;
      let h10 = match.recent10Home?.xg ?? 0;
      let h5 = match.recent5Home?.xg ?? 0;
      let hMax = Math.max(h15, h10, h5);

      let a15 = match.recent15Away?.xg ?? 0;
      let a10 = match.recent10Away?.xg ?? 0;
      let a5 = match.recent5Away?.xg ?? 0;
      let aMax = Math.max(a15, a10, a5);

      const hShots = (match.recent15Home?.totalShots || 0) + (match.recent10Home?.totalShots || 0);
      const aShots = (match.recent15Away?.totalShots || 0) + (match.recent10Away?.totalShots || 0);
      const hSot = (match.recent15Home?.shotsOnTarget || 0) + (match.recent10Home?.shotsOnTarget || 0);
      const aSot = (match.recent15Away?.shotsOnTarget || 0) + (match.recent10Away?.shotsOnTarget || 0);

      // Fallback inteligente caso a base de snapshots ainda tenha menos de 2 leituras na janela:
      let hVal = hMax;
      let aVal = aMax;
      if (hMax === 0 && aMax === 0) {
        const totalXgH = match.homeStats?.xg ?? 0;
        const totalXgA = match.awayStats?.xg ?? 0;

        if (totalXgH > 0 || totalXgA > 0) {
          hVal = parseFloat((totalXgH * 0.20).toFixed(2));
          aVal = parseFloat((totalXgA * 0.20).toFixed(2));
          h15 = hVal;
          a15 = aVal;
        }
      }

      // Diferenças de xG (ex: xG A - xG B >= 0.20 e xG B = 0.00)
      const hDiff = parseFloat((hVal - aVal).toFixed(2));
      const aDiff = parseFloat((aVal - hVal).toFixed(2));

      // CENÁRIO 2: LÁ E CÁ (Ambos os times com xG recente ou volume ofensivo)
      // Avaliado primeiro se ambos estiverem trocando golpes
      const isBothHighXg =
        (hVal >= this.criteria.openGameMinMutualXg && aVal >= this.criteria.openGameMinMutualXg) ||
        (hVal + aVal >= this.criteria.openGameMinCombinedXg && hVal > 0.02 && aVal > 0.02) ||
        (hShots + aShots >= this.criteria.openGameMinCombinedShots && hVal >= 0.03 && aVal >= 0.03);

      if (isBothHighXg) {
        const type: SuggestionType = 'OVER_OPEN_GAME';
        const targetLine = match.targetOver.targetLine;
        const oddVal = match.targetOver.foundOdd || match.targetOver.referenceOdd || 2.0;
        const oddStr = oddVal.toFixed(2);
        const sugId = `sug_${match.id}_open_${match.homeScore}_${match.awayScore}`;

        if (!this.suggestions.has(sugId)) {
          const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
          const awayLabel = match.awayTeam.shortName || match.awayTeam.name;
          const triggerReason = `Jogo Aberto: xG ${homeLabel} (+${hVal.toFixed(2)}) e xG ${awayLabel} (+${aVal.toFixed(2)}) mútuos | Soma xG: +${(hVal + aVal).toFixed(2)}`;

          const item: LiveSuggestionItem = {
            id: sugId,
            gameId: match.id,
            competitionName: match.competitionName,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            minute: match.minute,
            scoreAtTime: {
              home: match.homeScore,
              away: match.awayScore,
            },
            currentScore: {
              home: match.homeScore,
              away: match.awayScore,
            },
            type,
            typeLabel: 'Lá e Cá (Jogo Aberto)',
            targetLine,
            odd: oddVal,
            marketDescription: `Over ${targetLine}`,
            suggestionText: `O ${match.homeTeam.name} e o ${match.awayTeam.name} estão em um jogo agressivo de lá e cá, um gol deverá sair em breve. Sugestão: Over ${targetLine} Odd ${oddStr}`,
            triggerReason,
            xgDiff: hDiff,
            status: 'PENDENTE',
            createdAt: nowIso,
            metrics: {
              homeXg15: h15,
              awayXg15: a15,
              homeXg10: h10,
              awayXg10: a10,
              homeXg5: h5,
              awayXg5: a5,
              totalXg: match.accumulated.xg,
              recentShotsHome: hShots,
              recentShotsAway: aShots,
              recentSotHome: hSot,
              recentSotAway: aSot,
            },
          };

          this.suggestions.set(sugId, item);
          dbService.saveSuggestion(item);
        }
        continue;
      }

      // CENÁRIO 1: PRESSÃO UNILATERAL
      // Critério: (xG Dominante - xG Oponente >= unilateralMinXgDiff) AND (xG Oponente <= unilateralMaxOpponentXg)
      const isHomeDominant =
        (hDiff >= this.criteria.unilateralMinXgDiff && aVal <= this.criteria.unilateralMaxOpponentXg) ||
        (hVal >= this.criteria.unilateralMinDominantXg && aVal <= this.criteria.unilateralMaxOpponentXg) ||
        (this.criteria.unilateralMaxOpponentXg > 0 && aVal > 0 && hVal >= aVal * this.criteria.unilateralDominanceRatio && hDiff >= this.criteria.unilateralMinXgDiff);

      const isAwayDominant =
        (aDiff >= this.criteria.unilateralMinXgDiff && hVal <= this.criteria.unilateralMaxOpponentXg) ||
        (aVal >= this.criteria.unilateralMinDominantXg && hVal <= this.criteria.unilateralMaxOpponentXg) ||
        (this.criteria.unilateralMaxOpponentXg > 0 && hVal > 0 && aVal >= hVal * this.criteria.unilateralDominanceRatio && aDiff >= this.criteria.unilateralMinXgDiff);

      if (isHomeDominant && !isAwayDominant) {
        const type: SuggestionType = 'UNILATERAL_HOME';
        const sugId = `sug_${match.id}_uni_h_${match.homeScore}_${match.awayScore}`;

        if (!this.suggestions.has(sugId)) {
          const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
          const awayLabel = match.awayTeam.shortName || match.awayTeam.name;
          const triggerReason = `xG ${homeLabel} (+${hVal.toFixed(2)}) - xG ${awayLabel} (${aVal.toFixed(2)}) = +${hDiff.toFixed(2)} (≥ ${this.criteria.unilateralMinXgDiff.toFixed(2)}) | xG ${awayLabel} = ${aVal.toFixed(2)}`;

          const item: LiveSuggestionItem = {
            id: sugId,
            gameId: match.id,
            competitionName: match.competitionName,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            minute: match.minute,
            scoreAtTime: {
              home: match.homeScore,
              away: match.awayScore,
            },
            currentScore: {
              home: match.homeScore,
              away: match.awayScore,
            },
            type,
            typeLabel: 'Pressão Unilateral',
            dominantTeam: 'home',
            dominantTeamName: match.homeTeam.name,
            odd: match.targetOver.foundOdd,
            marketDescription: `Back ${match.homeTeam.name} / Lay ${match.awayTeam.name}`,
            suggestionText: `O ${match.homeTeam.name} está pressionando o ${match.awayTeam.name} e um gol pode sair em breve. Sugestão: Back ${match.homeTeam.name}, ou Lay ${match.awayTeam.name}`,
            triggerReason,
            xgDiff: hDiff,
            status: 'PENDENTE',
            createdAt: nowIso,
            metrics: {
              homeXg15: h15,
              awayXg15: a15,
              homeXg10: h10,
              awayXg10: a10,
              homeXg5: h5,
              awayXg5: a5,
              totalXg: match.accumulated.xg,
              recentShotsHome: hShots,
              recentShotsAway: aShots,
              recentSotHome: hSot,
              recentSotAway: aSot,
            },
          };

          this.suggestions.set(sugId, item);
          dbService.saveSuggestion(item);
        }
      } else if (isAwayDominant && !isHomeDominant) {
        const type: SuggestionType = 'UNILATERAL_AWAY';
        const sugId = `sug_${match.id}_uni_a_${match.homeScore}_${match.awayScore}`;

        if (!this.suggestions.has(sugId)) {
          const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
          const awayLabel = match.awayTeam.shortName || match.awayTeam.name;
          const triggerReason = `xG ${awayLabel} (+${aVal.toFixed(2)}) - xG ${homeLabel} (${hVal.toFixed(2)}) = +${aDiff.toFixed(2)} (≥ ${this.criteria.unilateralMinXgDiff.toFixed(2)}) | xG ${homeLabel} = ${hVal.toFixed(2)}`;

          const item: LiveSuggestionItem = {
            id: sugId,
            gameId: match.id,
            competitionName: match.competitionName,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            minute: match.minute,
            scoreAtTime: {
              home: match.homeScore,
              away: match.awayScore,
            },
            currentScore: {
              home: match.homeScore,
              away: match.awayScore,
            },
            type,
            typeLabel: 'Pressão Unilateral',
            dominantTeam: 'away',
            dominantTeamName: match.awayTeam.name,
            odd: match.targetOver.foundOdd,
            marketDescription: `Back ${match.awayTeam.name} / Lay ${match.homeTeam.name}`,
            suggestionText: `O ${match.awayTeam.name} está pressionando o ${match.homeTeam.name} e um gol pode sair em breve. Sugestão: Back ${match.awayTeam.name}, ou Lay ${match.homeTeam.name}`,
            triggerReason,
            xgDiff: aDiff,
            status: 'PENDENTE',
            createdAt: nowIso,
            metrics: {
              homeXg15: h15,
              awayXg15: a15,
              homeXg10: h10,
              awayXg10: a10,
              homeXg5: h5,
              awayXg5: a5,
              totalXg: match.accumulated.xg,
              recentShotsHome: hShots,
              recentShotsAway: aShots,
              recentSotHome: hSot,
              recentSotAway: aSot,
            },
          };

          this.suggestions.set(sugId, item);
          dbService.saveSuggestion(item);
        }
      }
    }

    // 2. Audit and resolve active pending suggestions
    const liveMatchMap = new Map<string, LiveMatchData>();
    for (const m of liveMatches) {
      liveMatchMap.set(m.id, m);
    }

    const rawMatchMap = new Map<string, RawMatchSummary>();
    if (rawMatches) {
      for (const r of rawMatches) {
        rawMatchMap.set(r.id, r);
      }
    }

    for (const sug of this.suggestions.values()) {
      if (sug.status !== 'PENDENTE') continue;

      const liveM = liveMatchMap.get(sug.gameId);
      const rawM = rawMatchMap.get(sug.gameId);

      const currentHomeScore = liveM ? liveM.homeScore : rawM ? rawM.homeTeam.score : sug.currentScore.home;
      const currentAwayScore = liveM ? liveM.awayScore : rawM ? rawM.awayTeam.score : sug.currentScore.away;
      const isFinished = liveM ? liveM.statusState === 'post' : rawM ? rawM.state === 'post' : false;
      const currentMinute = liveM ? liveM.minute : rawM ? rawM.minute : sug.minute;

      sug.currentScore = {
        home: currentHomeScore,
        away: currentAwayScore,
      };

      // Avaliação de UNILATERAL_HOME (Back Mandante)
      if (sug.type === 'UNILATERAL_HOME') {
        if (currentHomeScore > sug.scoreAtTime.home) {
          sug.status = 'GREEN';
          sug.resolvedAtMinute = currentMinute;
          sug.resolvedAt = nowIso;
          sug.resultNote = `Certeira! Gol do ${sug.homeTeam.name} aos ${currentMinute}'! (Placar: ${currentHomeScore}x${currentAwayScore})`;
          dbService.updateSuggestion(sug);
        } else if (isFinished) {
          sug.status = 'RED';
          sug.resolvedAtMinute = currentMinute;
          sug.resolvedAt = nowIso;
          sug.resultNote = `Encerrado sem gol do ${sug.homeTeam.name}. (Placar final: ${currentHomeScore}x${currentAwayScore})`;
          dbService.updateSuggestion(sug);
        } else {
          dbService.updateSuggestion(sug);
        }
      }

      // Avaliação de UNILATERAL_AWAY (Back Visitante)
      else if (sug.type === 'UNILATERAL_AWAY') {
        if (currentAwayScore > sug.scoreAtTime.away) {
          sug.status = 'GREEN';
          sug.resolvedAtMinute = currentMinute;
          sug.resolvedAt = nowIso;
          sug.resultNote = `Certeira! Gol do ${sug.awayTeam.name} aos ${currentMinute}'! (Placar: ${currentHomeScore}x${currentAwayScore})`;
          dbService.updateSuggestion(sug);
        } else if (isFinished) {
          sug.status = 'RED';
          sug.resolvedAtMinute = currentMinute;
          sug.resolvedAt = nowIso;
          sug.resultNote = `Encerrado sem gol do ${sug.awayTeam.name}. (Placar final: ${currentHomeScore}x${currentAwayScore})`;
          dbService.updateSuggestion(sug);
        } else {
          dbService.updateSuggestion(sug);
        }
      }

      // Avaliação de OVER_OPEN_GAME (Over targetLine)
      else if (sug.type === 'OVER_OPEN_GAME') {
        const totalGoals = currentHomeScore + currentAwayScore;
        const line = sug.targetLine || (sug.scoreAtTime.home + sug.scoreAtTime.away + 0.5);

        if (totalGoals >= line) {
          sug.status = 'GREEN';
          sug.resolvedAtMinute = currentMinute;
          sug.resolvedAt = nowIso;
          sug.resultNote = `Certeira! Over ${line} bateu aos ${currentMinute}'! (Placar: ${currentHomeScore}x${currentAwayScore})`;
          dbService.updateSuggestion(sug);
        } else if (isFinished) {
          sug.status = 'RED';
          sug.resolvedAtMinute = currentMinute;
          sug.resolvedAt = nowIso;
          sug.resultNote = `Encerrado com ${totalGoals} gols (Linha: Over ${line}).`;
          dbService.updateSuggestion(sug);
        } else {
          dbService.updateSuggestion(sug);
        }
      }
    }
  }

  /**
   * Returns suggestions filtered with summary statistics
   */
  public getSuggestions(filters?: {
    status?: SuggestionStatus | 'ALL';
    type?: SuggestionType | 'ALL';
  }): { data: LiveSuggestionItem[]; summary: SuggestionsSummary } {
    this.loadFromDb();
    let list = Array.from(this.suggestions.values());

    // Sort newest first
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = list.length;
    const greens = list.filter((s) => s.status === 'GREEN').length;
    const reds = list.filter((s) => s.status === 'RED').length;
    const pending = list.filter((s) => s.status === 'PENDENTE').length;
    const finished = greens + reds;
    const accuracyRate = finished > 0 ? parseFloat(((greens / finished) * 100).toFixed(1)) : 0;

    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((s) => s.status === filters.status);
    }

    if (filters?.type && filters.type !== 'ALL') {
      list = list.filter((s) => s.type === filters.type);
    }

    return {
      data: list,
      summary: {
        total,
        greens,
        reds,
        pending,
        accuracyRate,
      },
    };
  }
}

export const suggestionsService = new SuggestionsService();
