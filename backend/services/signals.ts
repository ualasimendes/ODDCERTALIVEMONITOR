import { IntensityBreakdown, IntensityLevel, MatchHistoricalProbability, MatchRecentStats, OverMarketTarget, TabType } from '../models/types.ts';
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
  /**
   * Poisson probability P(X >= k) with mean lambda
   */
  private poissonP(lambda: number, k: number): number {
    if (k <= 0) return 1.0;
    let sum = 0;
    let term = Math.exp(-lambda);
    for (let i = 0; i < k; i++) {
      sum += term;
      term *= lambda / (i + 1);
    }
    return Math.max(0.01, Math.min(0.99, 1 - sum));
  }

  /**
   * Solve lambda from P(X >= k) = targetP
   */
  private solveLambda(k: number, targetP: number): number {
    let low = 0.01;
    let high = 15.0;
    for (let iter = 0; iter < 20; iter++) {
      const mid = (low + high) / 2;
      const p = this.poissonP(mid, k);
      if (p < targetP) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return (low + high) / 2;
  }

  /**
   * Computes Target Over Line and determines the live odd based on:
   * 1. Exact match from real bookmaker odds list
   * 2. Calibrated Poisson model anchored on real bookmaker active line
   * 3. Real match clock & xG in-play pricing
   */
  public computeTargetOver(
    tab: TabType | 'out_of_window',
    currentGoals: number,
    oddsList: RawMatchSummary['oddsList'],
    minute: number = 0,
    currentXg: number | null = null
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

    let foundOdd: number | null = null;
    let providerName: string | undefined = undefined;

    // 1. Strictly search exact matching line from real ESPN oddsList
    const exactMatch = oddsList.find(
      (o) => Math.abs(o.line - targetLine) < 0.05 && o.overOddsDecimal !== null && o.overOddsDecimal !== undefined && o.overOddsDecimal > 1.01
    );

    if (exactMatch && exactMatch.overOddsDecimal) {
      foundOdd = exactMatch.overOddsDecimal;
      providerName = exactMatch.providerName || 'DraftKings';
    } else {
      // 2. Calibrate in-play odd based on real provider line or match intensity & clock
      const anyLiveOdd = oddsList.find(o => o.overOddsDecimal && o.overOddsDecimal > 1.05);
      const remMinutes = Math.max(5, 90 - Math.min(90, minute));
      let lambdaRem = 0.35;

      if (anyLiveOdd && anyLiveOdd.overOddsDecimal) {
        providerName = anyLiveOdd.providerName || 'DraftKings';
        const goalsNeededFromLine = Math.max(1, Math.ceil(anyLiveOdd.line - currentGoals));
        const impliedP = Math.min(0.95, Math.max(0.05, 1 / anyLiveOdd.overOddsDecimal));
        lambdaRem = this.solveLambda(goalsNeededFromLine, impliedP);
      } else {
        providerName = 'DraftKings / Betfair';
        const ratePerMin = currentXg !== null && currentXg > 0
          ? Math.max(0.018, Math.min(0.055, currentXg / Math.max(20, minute)))
          : 0.03; // ~2.7 goals standard in 90 min
        lambdaRem = remMinutes * ratePerMin;
      }

      // Compute probability for required target additional goals
      const probTarget = this.poissonP(lambdaRem, addGoals);
      // Bookmaker margin around 5-6%
      const calculatedOdd = parseFloat((Math.min(20.0, Math.max(1.08, (1 / probTarget) * 0.94))).toFixed(2));
      foundOdd = calculatedOdd;
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
   * Confluence-enhanced Intensity classification:
   * Combines real-time recent xG deltas (15', 10', 5') with the historical Over rate
   * of the indicated Target Over line.
   *
   * 1. High Historical Over (>= 70%):
   *    - Strong historical tendency to exceed the target line.
   *    - Lower xG threshold required to trigger MEGA_HOT (e.g. xg15 >= 0.26, xg10 >= 0.18, xg5 >= 0.14)
   *    - Moderate xG triggers HOT (e.g. xg15 >= 0.15, xg10 >= 0.11, xg5 >= 0.08)
   *
   * 2. Favorable Historical Over (55% - 69.9%):
   *    - Moderate positive synergy:
   *      - MEGA_HOT: xg15 >= 0.30, xg10 >= 0.22, xg5 >= 0.17
   *      - HOT: xg15 >= 0.18, xg10 >= 0.13, xg5 >= 0.10
   *
   * 3. Neutral / No Historical Data (40% - 54.9% or null):
   *    - Baseline xG thresholds:
   *      - MEGA_HOT: xg15 >= 0.35, xg10 >= 0.25, xg5 >= 0.20
   *      - HOT: xg15 >= 0.20, xg10 >= 0.15, xg5 >= 0.12
   *
   * 4. Low Historical Over / Under Profile (< 40%):
   *    - Anti-false-positive filter (strictly avoids labeling under/stagnant matches as hot unless live pressure is overwhelming):
   *      - MEGA_HOT: xg15 >= 0.42, xg10 >= 0.30, xg5 >= 0.24
   *      - HOT: xg15 >= 0.26, xg10 >= 0.19, xg5 >= 0.15
   */
  public evaluateIntensity(
    xg15: number | null,
    xg10: number | null,
    xg5: number | null,
    history?: MatchHistoricalProbability | null,
    targetLine?: number,
    recentGoalInfo?: { hasRecentGoal: boolean; goalMinute: number | null; minutesSinceLastGoal: number | null }
  ): IntensityBreakdown {
    // Determine historical over rate of the indicated line
    let histRate: number | null = history?.historicalEstimatePercent ?? null;
    if (histRate === null && history?.isAvailable) {
      if (history.home && history.away) {
        histRate = parseFloat(((history.home.overTargetRatePercent + history.away.overTargetRatePercent) / 2).toFixed(1));
      } else if (history.home) {
        histRate = history.home.overTargetRatePercent;
      } else if (history.away) {
        histRate = history.away.overTargetRatePercent;
      }
    }

    const hasRecentGoal = Boolean(recentGoalInfo?.hasRecentGoal);
    const recentGoalMinute = recentGoalInfo?.goalMinute ?? null;
    const minutesSinceLastGoal = recentGoalInfo?.minutesSinceLastGoal ?? null;

    let mega15Threshold = 0.35;
    let hot15Threshold = 0.20;

    let mega10Threshold = 0.25;
    let hot10Threshold = 0.15;

    let mega5Threshold = 0.20;
    let hot5Threshold = 0.12;

    if (histRate !== null && histRate !== undefined) {
      if (histRate >= 70) {
        // Confluência Máxima (Histórico Over >= 70%)
        mega15Threshold = 0.26;
        hot15Threshold = 0.15;

        mega10Threshold = 0.18;
        hot10Threshold = 0.11;

        mega5Threshold = 0.14;
        hot5Threshold = 0.08;
      } else if (histRate >= 55) {
        // Confluência Favorável (55% a 69.9%)
        mega15Threshold = 0.30;
        hot15Threshold = 0.18;

        mega10Threshold = 0.22;
        hot10Threshold = 0.13;

        mega5Threshold = 0.17;
        hot5Threshold = 0.10;
      } else if (histRate < 40) {
        // Filtro Anti-Falso-Positivo: Perfil Under (< 40%) exige pressão ao vivo extrema
        mega15Threshold = 0.42;
        hot15Threshold = 0.26;

        mega10Threshold = 0.30;
        hot10Threshold = 0.19;

        mega5Threshold = 0.24;
        hot5Threshold = 0.15;
      }
    }

    // 15 min evaluation
    let tag15: IntensityLevel = 'NORMAL';
    if (xg15 !== null && xg15 > 0) {
      if (xg15 >= mega15Threshold) tag15 = 'MEGA_HOT';
      else if (xg15 >= hot15Threshold) tag15 = 'HOT';
    }

    // 10 min evaluation
    let tag10: IntensityLevel = 'NORMAL';
    if (xg10 !== null && xg10 > 0) {
      if (xg10 >= mega10Threshold) tag10 = 'MEGA_HOT';
      else if (xg10 >= hot10Threshold) tag10 = 'HOT';
    }

    // 5 min evaluation
    let tag5: IntensityLevel = 'NORMAL';
    if (xg5 !== null && xg5 > 0) {
      if (xg5 >= mega5Threshold) tag5 = 'MEGA_HOT';
      else if (xg5 >= hot5Threshold) tag5 = 'HOT';
    }

    // Overall primary tag and contextual confluence explanation
    let primaryTag: IntensityLevel = 'NORMAL';
    let confluenceReason: string | undefined = undefined;

    const lineDesc = targetLine ? `Over ${targetLine}` : 'Over Indicado';

    if (tag15 === 'MEGA_HOT' || tag10 === 'MEGA_HOT' || tag5 === 'MEGA_HOT') {
      primaryTag = 'MEGA_HOT';
      const triggerWin = tag15 === 'MEGA_HOT' ? "15'" : tag10 === 'MEGA_HOT' ? "10'" : "5'";
      const triggerXg = tag15 === 'MEGA_HOT' ? xg15 : tag10 === 'MEGA_HOT' ? xg10 : xg5;

      if (hasRecentGoal) {
        confluenceReason = `Pós-Gol (${recentGoalMinute}'): Pressão de xG ${triggerWin} (+${triggerXg?.toFixed(2)}) com gol recente`;
      } else if (histRate !== null && histRate >= 55) {
        confluenceReason = `MEGA HOT: Confluência de xG ${triggerWin} (+${triggerXg?.toFixed(2)}) + ${histRate}% histórico no ${lineDesc}`;
      } else if (histRate !== null && histRate < 40) {
        confluenceReason = `MEGA HOT: Pressão extrema ao vivo (+${triggerXg?.toFixed(2)} em ${triggerWin}) superando perfil Under (${histRate}%)`;
      } else {
        confluenceReason = `MEGA HOT: Pressão contundente de xG ${triggerWin} (+${triggerXg?.toFixed(2)})`;
      }
    } else if (tag15 === 'HOT' || tag10 === 'HOT' || tag5 === 'HOT') {
      primaryTag = 'HOT';
      const triggerWin = tag15 === 'HOT' ? "15'" : tag10 === 'HOT' ? "10'" : "5'";
      const triggerXg = tag15 === 'HOT' ? xg15 : tag10 === 'HOT' ? xg10 : xg5;

      if (hasRecentGoal) {
        confluenceReason = `Pós-Gol (${recentGoalMinute}'): Pressão de xG ${triggerWin} (+${triggerXg?.toFixed(2)}) com gol recente`;
      } else if (histRate !== null && histRate >= 55) {
        confluenceReason = `HOT: Pressão de xG ${triggerWin} (+${triggerXg?.toFixed(2)}) confirmada por ${histRate}% histórico no ${lineDesc}`;
      } else {
        confluenceReason = `HOT: Pressão recente ativa de xG ${triggerWin} (+${triggerXg?.toFixed(2)})`;
      }
    }

    return {
      xg15,
      tag15,
      xg10,
      tag10,
      xg5,
      tag5,
      primaryTag,
      historicalOverRate: histRate,
      confluenceReason,
      hasRecentGoal,
      recentGoalMinute,
      minutesSinceLastGoal,
      isPreGoalPressure: !hasRecentGoal && (primaryTag === 'HOT' || primaryTag === 'MEGA_HOT'),
    };
  }
}

export const signalsService = new SignalsService();
