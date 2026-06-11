import type { PlayerView } from '@xwing/engine';
import type { ReactElement } from 'react';
import { previewFor, SvgBoard } from './board';
import { Controls } from './controls';
import { useOnline } from './online-store';

const otherSeat = (view: PlayerView, seat: string | null): string | null =>
  view.players.find((p) => p.id !== seat)?.id ?? null;

export function OnlineGame(): ReactElement {
  const status = useOnline((s) => s.status);
  const view = useOnline((s) => s.view);
  const seat = useOnline((s) => s.seat);
  const code = useOnline((s) => s.code);
  const isHost = useOnline((s) => s.isHost);
  const rejection = useOnline((s) => s.rejection);
  const error = useOnline((s) => s.error);
  const send = useOnline((s) => s.send);
  const leave = useOnline((s) => s.leave);

  const shareUrl = code ? `${location.origin}?game=${code}` : '';

  if (status === 'error') {
    return (
      <Shell>
        <div className="panel">
          <div className="panelHead">Connection lost</div>
          <p className="muted">{error ?? 'Something went wrong.'}</p>
          <button className="btn primary" onClick={leave}>
            Back to menu
          </button>
        </div>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <div className="panel">
          <div className="panelHead">Connecting…</div>
          {code && <p className="muted">Game code: {code}</p>}
        </div>
      </Shell>
    );
  }

  const pending = view.pending[0];
  const myTurn = !!pending && pending.playerId === seat;
  const nameOf = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? id ?? '';
  const highlightIds =
    pending?.type === 'declare-attack'
      ? pending.options.targets
      : pending?.type === 'perform-action'
        ? pending.options.lockTargets
        : [];
  const winner = view.gameOver
    ? view.players.find((p) => view.ships.some((s) => s.ownerId === p.id && s.hull > 0))
    : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">X-Wing Online</div>
        <div className="status">
          Round {view.round} · {view.phase} · you: {nameOf(seat)}
        </div>
        <button className="btn ghost sm" onClick={leave}>
          Leave
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
          {isHost && code && !view.gameOver && (
            <div className="panel">
              <div className="panelHead">Invite a friend</div>
              <p className="muted">They join as the opposing side.</p>
              <div className="codeBox">{shareUrl}</div>
              <div className="inviteRow">
                <span className="muted">
                  code: <strong>{code}</strong>
                </span>
                <button
                  className="btn sm"
                  onClick={() => void navigator.clipboard?.writeText(shareUrl)}
                >
                  Copy link
                </button>
              </div>
            </div>
          )}

          {view.gameOver ? (
            <div className="panel">
              <div className="panelHead">Game over</div>
              <p>{winner ? `${winner.name} wins.` : 'Mutual destruction.'}</p>
              <button className="btn primary" onClick={leave}>
                Back to menu
              </button>
            </div>
          ) : myTurn ? (
            <>
              <div className="who">
                Your move, <strong>{nameOf(seat)}</strong>
              </div>
              <Controls view={view} onSend={send} />
              {rejection && <div className="reject">{rejection}</div>}
            </>
          ) : (
            <div className="panel">
              <div className="panelHead">Waiting for {nameOf(otherSeat(view, seat))}…</div>
              <p className="muted">It’s their turn.</p>
            </div>
          )}
        </aside>
      </main>

      <footer className="disclaimerBar">
        Fan project — not endorsed by or affiliated with Atomic Mass Games. Go buy the real models.
      </footer>
    </div>
  );
}

function Shell({ children }: { children: ReactElement }): ReactElement {
  return (
    <div className="setup">
      <div className="setupCard">{children}</div>
    </div>
  );
}
