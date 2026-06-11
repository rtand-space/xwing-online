import type { ReactElement } from 'react';
import { Controls } from './controls';
import type { ActiveGame } from './useActiveGame';

/** Bottom flyout: game actions for the current turn (dial, action, attack). */
export function BottomFlyout({ ag }: { ag: ActiveGame }): ReactElement | null {
  if (ag.mode === 'none' || !ag.view) return null;
  const view = ag.view;
  const nameOf = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? id ?? '';

  let body: ReactElement;
  if (view.gameOver) {
    const winner = view.players.find((p) =>
      view.ships.some((s) => s.ownerId === p.id && s.hull > 0),
    );
    body = (
      <div className="bottomMsg">
        <span>{winner ? `${winner.name} wins.` : 'Mutual destruction.'}</span>
        <button className="btn primary" onClick={ag.leave}>
          {ag.online ? 'Back to menu' : 'New game'}
        </button>
      </div>
    );
  } else if (ag.needsUnlock) {
    body = (
      <div className="bottomMsg">
        <span>
          Pass the device to <strong>{nameOf(view.pending[0]?.playerId ?? null)}</strong>.
        </span>
        <button className="btn primary" onClick={ag.unlock}>
          Ready
        </button>
      </div>
    );
  } else if (ag.myTurn) {
    body = <Controls view={view} onSend={ag.send} />;
  } else {
    body = (
      <div className="bottomMsg muted">
        Waiting for {nameOf(view.pending[0]?.playerId ?? null)}…
      </div>
    );
  }

  return (
    <div className="flyout bottom open">
      <div className="flyoutBody">{body}</div>
    </div>
  );
}
