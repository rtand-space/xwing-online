import { type CSSProperties, type ReactElement, useEffect, useState } from 'react';
import { Controls } from './controls';
import type { ActiveGame } from './useActiveGame';

/** Bottom HUD: a narrow, glassy panel of game actions floating over the board. */
export function BottomFlyout({ ag }: { ag: ActiveGame }): ReactElement | null {
  const [collapsed, setCollapsed] = useState(false);
  const view = ag.view;
  const pending = view?.pending[0];

  // Surface the HUD whenever a fresh decision lands on this device.
  const turnKey = ag.myTurn
    ? `${pending?.type ?? ''}:${pending?.shipId ?? ''}`
    : ag.needsUnlock
      ? 'unlock'
      : '';
  useEffect(() => {
    if (turnKey) setCollapsed(false);
  }, [turnKey]);

  if (ag.mode === 'none' || !view) return null;
  const nameOf = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? id ?? '';

  let title: string;
  let body: ReactElement;
  if (view.gameOver) {
    const winner = view.players.find((p) =>
      view.ships.some((s) => s.ownerId === p.id && s.hull > 0),
    );
    title = 'Game over';
    body = (
      <div className="bottomMsg">
        <span>{winner ? `${winner.name} wins.` : 'Mutual destruction.'}</span>
        <button className="btn primary" onClick={ag.leave}>
          {ag.online ? 'Menu' : 'New game'}
        </button>
      </div>
    );
  } else if (ag.needsUnlock) {
    title = 'Pass the device';
    body = (
      <div className="bottomMsg">
        <span>
          Hand it to <strong>{nameOf(pending?.playerId ?? null)}</strong>.
        </span>
        <button className="btn primary" onClick={ag.unlock}>
          Ready
        </button>
      </div>
    );
  } else if (ag.myTurn) {
    title = 'Your move';
    body = <Controls view={view} onSend={ag.send} />;
  } else {
    title = 'Waiting';
    body = <div className="bottomMsg muted">Waiting for {nameOf(pending?.playerId ?? null)}…</div>;
  }

  const cue = ag.myTurn || ag.needsUnlock;
  const className = `flyout bottom open${collapsed ? ' collapsed' : ''}${cue ? ' cue' : ''}`;
  const style =
    cue && ag.activeColor ? ({ ['--cue']: ag.activeColor } as CSSProperties) : undefined;

  return (
    <div className={className} style={style}>
      <button
        className="hudHandle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Show actions' : 'Hide actions'}
      >
        <span className="hudTitle">{title}</span>
        <span className="chev">{collapsed ? '▲' : '▾'}</span>
      </button>
      {!collapsed && <div className="flyoutBody">{body}</div>}
    </div>
  );
}
