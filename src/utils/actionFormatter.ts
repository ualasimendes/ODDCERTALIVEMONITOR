import { MatchTimelineAction } from '../types.ts';

export interface FormattedTimelineAction {
  category: 'goal' | 'saved' | 'blocked' | 'missed' | 'woodwork' | 'other';
  badgeLabel: string;
  badgeClass: string;
  headline: string;

  // 4 Pilares estruturados obrigatórios: Finalização / [dentro/fora](área) / [alvo/fora/trave](gol) / se foi gol ou não
  actionType: string;             // "Finalização" (ou com especificação ex: "Finalização de pé direito", "Cabeceio")
  area: 'Dentro da área' | 'Fora da área';
  target: 'No alvo' | 'Pra fora' | 'Na trave';
  isGoalResult: boolean;
  goalStatusText: 'GOL' | 'NÃO FOI GOL';
  goalDetail?: string;            // "Defesa do goleiro", "Bloqueado pela zaga", "Para fora", "Gol confirmado"
  structuredLine: string;         // "Finalização / Dentro da área / No alvo / GOL"

  descriptionPt: string;          // Narrativa descritiva completa em português
  assistPt?: string;
  playerDisplay: string;
  teamDisplay: string;
  locationLabel: string;
  minuteDisplay: string;
  xgDisplay: string;
}

/**
 * Traduz e estrutura o comentário do lance seguindo rigorosamente a taxonomia:
 * Finalização / [dentro/fora](área) / [alvo/fora/trave](gol) / se foi gol ou não.
 */
export function formatTimelineAction(action: MatchTimelineAction): FormattedTimelineAction {
  const raw = (action.description || '').trim();
  const lower = raw.toLowerCase();

  // 1. Identificar se foi GOL ou NÃO
  const isGoal = Boolean(action.isGoal || lower.includes('goal!'));
  const goalStatusText: 'GOL' | 'NÃO FOI GOL' = isGoal ? 'GOL' : 'NÃO FOI GOL';

  // 2. Localização: [dentro/fora](área)
  const isInside = Boolean(
    action.isInsideBox ||
    lower.includes('centre of the box') ||
    lower.includes('six yard box') ||
    lower.includes('penalty') ||
    lower.includes('very close range') ||
    lower.includes('left side of the box') ||
    lower.includes('right side of the box')
  );
  const area: 'Dentro da área' | 'Fora da área' = isInside ? 'Dentro da área' : 'Fora da área';

  // 3. Direção em relação ao gol: [alvo/fora/trave](gol)
  let target: 'No alvo' | 'Pra fora' | 'Na trave' = 'Pra fora';
  let category: FormattedTimelineAction['category'] = 'other';
  let badgeLabel = 'Lance';
  let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
  let goalDetail: string | undefined = undefined;

  if (isGoal) {
    target = 'No alvo';
    category = 'goal';
    badgeLabel = '⚽ GOL';
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-black';
    goalDetail = 'Gol confirmado';
  } else if (
    lower.includes('woodwork') ||
    lower.includes('post') ||
    lower.includes('bar!') ||
    lower.includes('hits the bar') ||
    lower.includes('crossbar')
  ) {
    target = 'Na trave';
    category = 'woodwork';
    badgeLabel = '💥 NA TRAVE';
    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold';
    goalDetail = 'Bola na trave';
  } else if (action.isOnTarget || lower.includes('saved')) {
    target = 'No alvo';
    category = 'saved';
    badgeLabel = '🎯 NO GOL';
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
    goalDetail = 'Defesa do goleiro';
  } else if (lower.includes('blocked')) {
    target = 'No alvo'; // finalização em direção à meta travada pelo bloqueio da defesa
    category = 'blocked';
    badgeLabel = '🛡️ BLOQUEADO';
    badgeClass = 'bg-slate-850 text-slate-300 border-slate-700/80 font-bold';
    goalDetail = 'Bloqueado pela defesa';
  } else {
    target = 'Pra fora';
    category = 'missed';
    badgeLabel = '💨 PRA FORA';
    badgeClass = 'bg-slate-800/80 text-slate-400 border-slate-700 font-medium';
    goalDetail = 'Para fora';
  }

  // 4. Tipo de Finalização
  let shotType = 'Finalização';
  if (lower.includes('header')) shotType = 'Cabeceio';
  else if (lower.includes('right footed shot')) shotType = 'Chute de pé direito';
  else if (lower.includes('left footed shot')) shotType = 'Chute de pé esquerdo';
  else if (lower.includes('penalty kick') || lower.includes('penalty')) shotType = 'Cobrança de pênalti';
  else if (lower.includes('free kick')) shotType = 'Cobrança de falta direta';

  // Linha canônica estruturada
  const structuredLine = `Finalização / ${area} / ${target} / ${goalStatusText}${
    !isGoal && goalDetail ? ` (${goalDetail})` : ''
  }`;

  // 5. Extrair Jogador
  let player = action.player;
  if (!player) {
    const pMatch = raw.match(/([A-ZÀ-ÿ][a-zA-ZÀ-ÿ\s'-]+)\s*\(([^)]+)\)/);
    if (pMatch) {
      player = pMatch[1].trim();
    }
  }
  const playerDisplay = player || action.teamName;
  const teamDisplay = action.teamAbbr || action.teamName;

  // 6. Extrair Assistência
  let assistPt: string | undefined = undefined;
  const assistMatch = raw.match(/Assisted by\s+([^.]+)/i);
  if (assistMatch) {
    let rawAssist = assistMatch[1].trim();
    rawAssist = rawAssist
      .replace(/with a cross following a corner/gi, 'com cruzamento após escanteio')
      .replace(/with a cross/gi, 'com cruzamento')
      .replace(/with a through ball/gi, 'com passe em profundidade')
      .replace(/with a headed pass/gi, 'com passe de cabeça')
      .replace(/following a fast break/gi, 'em contra-ataque rápido')
      .replace(/following a set piece situation/gi, 'em bola parada');
    assistPt = `Assistência de ${rawAssist}`;
  }

  // 7. Descrição narrativa fluida em Português
  let locationPt = isInside ? 'de dentro da grande área' : 'de fora da grande área';
  if (lower.includes('centre of the box')) locationPt = 'do meio da grande área';
  else if (lower.includes('six yard box') || lower.includes('very close range')) locationPt = 'da pequena área';
  else if (lower.includes('left side of the box')) locationPt = 'pelo lado esquerdo da área';
  else if (lower.includes('right side of the box')) locationPt = 'pelo lado direito da área';

  let outcomePt = '';
  if (isGoal) {
    if (lower.includes('bottom left corner')) outcomePt = 'no canto inferior esquerdo';
    else if (lower.includes('bottom right corner')) outcomePt = 'no canto inferior direito';
    else if (lower.includes('top left corner')) outcomePt = 'no ângulo esquerdo';
    else if (lower.includes('top right corner')) outcomePt = 'no ângulo direito';
    else if (lower.includes('centre of the goal')) outcomePt = 'no meio do gol';
    else outcomePt = 'no fundo das redes';
  } else if (category === 'saved') {
    const gkMatch = raw.match(/saved in the ([^.]+) by ([^.]+)/i);
    if (gkMatch) {
      const pos = gkMatch[1]
        .replace(/bottom left corner/gi, 'canto inferior esquerdo')
        .replace(/bottom right corner/gi, 'canto inferior direito')
        .replace(/top left corner/gi, 'ângulo esquerdo')
        .replace(/top right corner/gi, 'ângulo direito')
        .replace(/centre of the goal/gi, 'meio do gol');
      outcomePt = `defendido no ${pos} pelo goleiro ${gkMatch[2].trim()}`;
    } else if (lower.includes('bottom left corner')) {
      outcomePt = 'defendido no canto inferior esquerdo';
    } else if (lower.includes('bottom right corner')) {
      outcomePt = 'defendido no canto inferior direito';
    } else if (lower.includes('centre of the goal')) {
      outcomePt = 'defendido no meio do gol';
    } else {
      outcomePt = 'defendido pelo goleiro';
    }
  } else if (category === 'woodwork') {
    if (lower.includes('hits the bar') || lower.includes('crossbar')) outcomePt = 'explodiu no travessão';
    else if (lower.includes('left post')) outcomePt = 'bateu na trave esquerda';
    else if (lower.includes('right post')) outcomePt = 'bateu na trave direita';
    else outcomePt = 'acertou a trave';
  } else if (category === 'blocked') {
    outcomePt = 'travado pela marcação da defesa';
  } else {
    if (lower.includes('misses to the left')) outcomePt = 'saiu rente à trave esquerda';
    else if (lower.includes('misses to the right')) outcomePt = 'saiu rente à trave direita';
    else if (lower.includes('high and wide to the left')) outcomePt = 'passou por cima e à esquerda do gol';
    else if (lower.includes('high and wide to the right')) outcomePt = 'passou por cima e à direita do gol';
    else if (lower.includes('too high') || lower.includes('over the bar')) outcomePt = 'passou por cima do travessão';
    else outcomePt = 'foi para fora da meta';
  }

  let descriptionPt = `${shotType} de ${playerDisplay} ${locationPt}, ${outcomePt}.`;
  if (isGoal) {
    descriptionPt = `Gol de ${playerDisplay}: ${shotType.toLowerCase()} ${locationPt} ${outcomePt}.`;
  }

  return {
    category,
    badgeLabel,
    badgeClass,
    headline: `${shotType}: ${playerDisplay}`,
    actionType: shotType,
    area,
    target,
    isGoalResult: isGoal,
    goalStatusText,
    goalDetail,
    structuredLine,
    descriptionPt,
    assistPt,
    playerDisplay,
    teamDisplay,
    locationLabel: area,
    minuteDisplay: action.timeDisplay || `${action.minute}'`,
    xgDisplay: `+${(action.xg || 0).toFixed(2)} xG`,
  };
}
