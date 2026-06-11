import type { ReactElement } from 'react';
import { previewFor, SvgBoard } from './board';
import { Controls } from './controls';
import { formatEvent } from './log';
import { Setup } from './setup';
import { currentPlayer, useGame, viewFor } from './store';

export function App(): ReactElement {
  const game = useGame((s) => s.game);
  const unlockedFor = useGame((s) => s.unlockedFor);
  const unlock = useGame((s) => s.unlock);
  const reset = useGame((s) => s.reset);
  const rejection = useGame((s) => s.rejection);

  if (!game) return <Setup />;

  const cp = currentPlayer(game);
  const view = viewFor(game, cp);
  const nameOf = (id: string | null) =>
    game.state.players.find((p) => p.id === id)?.name ?? id ?? '';
  const pending = view.pending[0];
  const highlightIds =
    pending?.type === 'declare-attack'
      ? pending.options.targets
      : pending?.type === 'perform-action'
        ? pending.options.lockTargets
        : [];

  const lines = game.log
    .map(formatEvent)
    .filter((l): l is string => l !== null)
    .slice(-14);

  const winner = game.state.gameOver
    ? game.state.players.find((p) => game.state.ships.some((s) => s.ownerId === p.id && s.hull > 0))
    : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">X-Wing Online</div>
        <div className="status">
          Round {game.state.round} · {game.state.phase}
        </div>
        <button className="btn ghost sm" onClick={reset}>
          New game
        </button>
      </header>

      <main className="layout">
        <section className="boardWrap">
          <SvgBoard
            view={view}
            activeId={pending?.shipId}
            highlightIds={highlightIds}
            preview={pending?.type === 'execute-maneuver' ? previewFor(view, pending.shipId) : null}
          />
        </section>

        <aside className="side">
          {game.state.gameOver ? (
            <div className="panel">
              <div className="panelHead">Game over</div>
              <p>{winner ? `${winner.name} wins.` : 'Mutual destruction.'}</p>
              <button className="btn primary" onClick={reset}>
                Play again
              </button>
            </div>
          ) : cp && unlockedFor !== cp ? (
            <div className="panel pass">
              <div className="panelHead">Pass the device</div>
              <p>
                Hand it to <strong>{nameOf(cp)}</strong>. Keep your dials secret!
              </p>
              <button className="btn primary" onClick={() => unlock(cp)}>
                I’m {nameOf(cp)} — ready
              </button>
            </div>
          ) : (
            <>
              <div className="who">
                Active: <strong>{nameOf(cp)}</strong>
              </div>
              <Controls view={view} />
              {rejection && <div className="reject">{rejection}</div>}
            </>
          )}

          <div className="logPanel">
            {lines.map((l, i) => (
              <div key={i} className="logLine">
                {l}
              </div>
            ))}
          </div>
        </aside>
      </main>

      <footer className="disclaimerBar">
        Fan project — not endorsed by or affiliated with Atomic Mass Games. Go buy the real models.
      </footer>
    </div>
  );
}
