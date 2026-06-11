import type { ReactElement } from 'react';
import type { ActiveGame } from './useActiveGame';

/** Always-visible top bar: menu toggle, brand, and an at-a-glance status. */
export function TopNav({
  ag,
  onToggleSide,
}: {
  ag: ActiveGame;
  onToggleSide: () => void;
}): ReactElement {
  return (
    <header className="topnav">
      <button className="navBtn" onClick={onToggleSide} aria-label="Menu">
        ☰
      </button>
      <div className="brand">X-Wing Online</div>
      <div className="navStatus">
        {ag.online && <span className={`liveDot ${ag.view ? 'on' : ''}`} aria-hidden="true" />}
        {ag.statusLabel}
      </div>
    </header>
  );
}
