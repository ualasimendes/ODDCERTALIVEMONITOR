import { IntensityBreakdown, IntensityLevel, MatchRecentStats, OverMarketTarget, TabType } from '../models/types.ts';
import { RawMatchSummary } from '../providers/types.ts';

export class SignalsService {
  /**
   * Determine the time window tab for the match:
   * ABA 1 — OVER LIMITE: minute > 75
   * ABA 2 — OVER À FRENTE: minute > 60 and <= 75
   * ABA 3 — OVER LONGA: minute >= 25 and <= 45
   */
  public classifyTab(minute: number): TabType | 'out_of_window' {
    if (minute > 75) {
      return 'over_limite';
    } else if (minute > 60 && minute <= 75) {
      return 'over_frente';
    } else if (minute >= 25 && minute <= 45) {
      return 'over_longa';
    }
    return 'out_of_window';
  }

  /**
   * Calculate Target Over line and reference odd
   * REGRA FUNDAMENTAL:
   * LINHA OVER = GOLS ATUAIS + GOLS ADICIONAIS DESEJADOS - 0.5
   * 
   * additionalGoals:
   * OVER LIMITE   (>75')      = 1 gol adicional  -> currentGoals + 1 - 0.5
   * OVER À FRENTE (>60'..75') = 2 gols adicionais -> currentGoals + 2 - 0.5
   * OVER LONGA    (25'..45')  = 3 gols adicionais -> currentGoals + 3 - 0.5 (Alvo 3 gols)
   */
  public computeTargetOver(
    tab: TabType | 'out_of_window',
    currentGoals: number,
    oddsList: RawMatchSummary['oddsList']
  ): OverMarketTarget {
    const additionalGoals: Record<string, number> = {
      over_limite: 1,
      over_frente: 2,
      over_longa: 3,
    };

    const addGoals = additionalGoals[tab] ?? 1;
    const targetTotalGoals = currentGoals + addGoals;
    const targetLine = targetTotalGoals - 0.5;

    let referenceOdd = 2.0;
    let marketDescription = `Over ${targetLine}`;

    if (tab === 'over_limite') {
      referenceOdd = 2.0;
      marketDescription = `Falta 1 gol (Over ${targetLine})`;
    } else if (tab === 'over_frente') {
      referenceOdd = 3.0;
      marketDescription = `Faltam 2 gols (Over ${targetLine})`;
    } else if (tab === 'over_longa') {
      referenceOdd = 3.0;
      marketDescription = `Faltam 3 gols (Over ${targetLine})`;
    }

    // Strictly search exact matching line from real ESPN oddsList
    let foundOdd: number | null = null;
    let providerName: string | undefined = undefined;

    const exactMatch = oddsList.find(
      (o) => Math.abs(o.line - targetLine) < 0.05 && o.overOddsDecimal !== null && o.overOddsDecimal !== undefined
    );
    if (exactMatch && exactMatch.overOddsDecimal) {
      foundOdd = exactMatch.overOddsDecimal;
      providerName = exactMatch.providerName;
    }

    const isAboveReference = foundOdd !== null && foundOdd >= referenceOdd;

    return {
      tab: tab === 'out_of_window' ? 'over_limite' : tab,
      targetLine,
      referenceOdd,
      foundOdd,
      isAboveReference,
      providerName,
      marketDescription,
    };
  }

  /**
   * Intensity classification based strictly on recent xG thresholds:
   * Últimos 15 min: xG > 0.35: MEGA HOT, xG > 0.20: HOT
   * Últimos 10 min: xG > 0.25: MEGA HOT, xG > 0.15: HOT
   * Últimos 5 min:  xG > 0.20: MEGA HOT, xG > 0.15: HOT
   * Primary tag rule: If Mega Hot is reached in any window, primary tag is MEGA_HOT (never show both).
   */
  public evaluateIntensity(
    xg15: number | null,
    xg10: number | null,
    xg5: number | null
  ): IntensityBreakdown {
    // 15 min evaluation
    let tag15: IntensityLevel = 'NORMAL';
    if (xg15 !== null) {
      if (xg15 > 0.35) tag15 = 'MEGA_HOT';
      else if (xg15 > 0.20) tag15 = 'HOT';
    }

    // 10 min evaluation
    let tag10: IntensityLevel = 'NORMAL';
    if (xg10 !== null) {
      if (xg10 > 0.25) tag10 = 'MEGA_HOT';
      else if (xg10 > 0.15) tag10 = 'HOT';
    }

    // 5 min evaluation
    let tag5: IntensityLevel = 'NORMAL';
    if (xg5 !== null) {
      if (xg5 > 0.20) tag5 = 'MEGA_HOT';
      else if (xg5 > 0.15) tag5 = 'HOT';
    }

    // Overall primary tag
    let primaryTag: IntensityLevel = 'NORMAL';
    if (tag15 === 'MEGA_HOT' || tag10 === 'MEGA_HOT' || tag5 === 'MEGA_HOT') {
      primaryTag = 'MEGA_HOT';
    } else if (tag15 === 'HOT' || tag10 === 'HOT' || tag5 === 'HOT') {
      primaryTag = 'HOT';
    }

    return {
      xg15,
      tag15,
      xg10,
      tag10,
      xg5,
      tag5,
      primaryTag,
    };
  }
}

export const signalsService = new SignalsService();
