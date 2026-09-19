import React from 'react';
import { AnimatePresence } from 'motion/react';
import { LiveMatchData } from '../types.ts';
import { MatchCard } from './MatchCard.tsx';

interface CompetitionGroupProps {
  competitionName: string;
  matches: LiveMatchData[];
  onOpenDetailModal: (match: LiveMatchData) => void;
}

export function getLeagueEmoji(leagueName: string): string {
  const lower = leagueName.toLowerCase();
  if (lower.includes('brasil') || lower.includes('brasileir') || lower.includes('paulista') || lower.includes('carioca')) {
    return '🇧🇷';
  }
  if (lower.includes('premier') || lower.includes('england') || lower.includes('fa cup') || lower.includes('championship')) {
    return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  }
  if (lower.includes('la liga') || lower.includes('laliga') || lower.includes('spain') || lower.includes('copa del rey')) {
    return '🇪🇸';
  }
  if (lower.includes('serie a') || lower.includes('italy') || lower.includes('coppa italia')) {
    return '🇮🇹';
  }
  if (lower.includes('bundesliga') || lower.includes('germany') || lower.includes('dfb')) {
    return '🇩🇪';
  }
  if (lower.includes('ligue 1') || lower.includes('france') || lower.includes('coupe de france')) {
    return '🇫🇷';
  }
  if (lower.includes('champions league') || lower.includes('europa league') || lower.includes('conference')) {
    return '🏆';
  }
  if (lower.includes('libertadores') || lower.includes('sudamericana') || lower.includes('sul-americana')) {
    return '🌎';
  }
  if (lower.includes('mls') || lower.includes('major league soccer')) {
    return '🇺🇸';
  }
  if (lower.includes('eredivisie') || lower.includes('netherlands')) {
    return '🇳🇱';
  }
  if (lower.includes('primeira liga') || lower.includes('portugal')) {
    return '🇵🇹';
  }
  return '⚽';
}

export const CompetitionGroup: React.FC<CompetitionGroupProps> = ({
  competitionName,
  matches,
  onOpenDetailModal,
}) => {
  const emoji = getLeagueEmoji(competitionName);

  return (
    <section className="space-y-3" aria-label={`Liga ${competitionName}`}>
      {/* Group Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/90">
        <div className="flex items-center gap-2.5">
          <span className="text-base select-none" role="img" aria-label="Bandeira ou ícone da competição">
            {emoji}
          </span>
          <h2 className="text-sm font-bold font-sans uppercase tracking-wide text-white">
            {competitionName}
          </h2>
        </div>

        <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-full font-medium">
          {matches.length} {matches.length === 1 ? 'jogo ao vivo' : 'jogos ao vivo'}
        </span>
      </div>

      {/* Grid of Matches: 1 col (mobile), 2 cols (tablet), 3 cols (desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onOpenDetailModal={onOpenDetailModal}
            />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
};

