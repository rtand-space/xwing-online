import type { CSSProperties, ReactElement } from 'react';
import type { ActiveGame } from './useActiveGame';

const PHASE_LABEL: Record<string, string> = {
  planning: 'Planning',
  system: 'System',
  activation: 'Activation',
  engagement: 'Engagement',
  end: 'End',
};

/** Extremely minimal: brand, the current phase (if any), menu toggle. */
export function TopNav({
  ag,
  onToggleSide,
}: {
  ag: ActiveGame;
  onToggleSide: () => void;
}): ReactElement {
  const accent = ag.activeColor ?? 'var(--pine)';
  const label = ag.view
    ? ag.view.gameOver
      ? 'Game over'
      : (PHASE_LABEL[ag.view.phase] ?? '')
    : '';

  return (
    <header className="topnav">
      <div className="brand">X-Wing</div>
      <div className="navRight">
        {label && (
          <span
            className={ag.myTurn ? 'phasePill cue' : 'phasePill'}
            style={{ color: accent, borderColor: accent, ['--cue']: accent } as CSSProperties}
          >
            {label}
          </span>
        )}
        <button className="navBtn" onClick={onToggleSide} aria-label="Menu">
          ☰
        </button>
      </div>
    </header>
  );
}
