import type { CSSProperties, ReactElement } from 'react';
import type { ActiveGame } from './useActiveGame';

const STEPS = ['Plan', 'Move', 'Engage', 'End'];
const PHASE_STEP: Record<string, number> = {
  planning: 0,
  system: 0,
  activation: 1,
  engagement: 2,
  end: 3,
};

/** Always-visible top bar: phase stepper, faction-tinted turn cue, menu toggle. */
export function TopNav({
  ag,
  onToggleSide,
}: {
  ag: ActiveGame;
  onToggleSide: () => void;
}): ReactElement {
  const phase = ag.view?.phase;
  const step = phase ? (PHASE_STEP[phase] ?? -1) : -1;
  const accent = ag.activeColor ?? 'var(--pine)';

  return (
    <header className="topnav">
      <div className="brand">X-Wing</div>

      {ag.view && (
        <div className="stepper" aria-label={`Phase: ${STEPS[step] ?? ''}`}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={i === step ? 'step on' : 'step'}
              style={
                i === step ? ({ color: accent, borderColor: accent } as CSSProperties) : undefined
              }
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className={ag.myTurn ? 'navStatus yourTurn' : 'navStatus'}>
        {ag.view && (
          <span
            className="liveDot"
            aria-hidden="true"
            style={
              {
                background: accent,
                boxShadow: ag.myTurn ? `0 0 8px ${accent}` : 'none',
              } as CSSProperties
            }
          />
        )}
        {ag.statusLabel}
      </div>

      <button className="navBtn" onClick={onToggleSide} aria-label="Menu">
        ☰
      </button>
    </header>
  );
}
