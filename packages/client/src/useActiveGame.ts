import type { Command, PlayerView } from '@xwing/engine';
import { useOnline } from './online-store';
import { currentPlayer, useGame, viewFor } from './store';

/** Unifies the local hot-seat and online stores into one context for the shell. */
export interface ActiveGame {
  mode: 'none' | 'local' | 'online';
  online: boolean;
  view: PlayerView | null;
  send: (command: Command) => void;
  pendingShipId: string | null;
  myTurn: boolean;
  needsUnlock: boolean; // local pass-and-play privacy gate
  unlock: () => void;
  statusLabel: string;
  isHost: boolean;
  code: string | null;
  onlineError: string | null;
  leave: () => void;
}

const nameOf = (view: PlayerView | null, id: string | null): string =>
  view?.players.find((p) => p.id === id)?.name ?? id ?? '';

export function useActiveGame(): ActiveGame {
  const onlineStatus = useOnline((s) => s.status);
  const onlineView = useOnline((s) => s.view);
  const onlineSeat = useOnline((s) => s.seat);
  const onlineSend = useOnline((s) => s.send);
  const isHost = useOnline((s) => s.isHost);
  const code = useOnline((s) => s.code);
  const onlineError = useOnline((s) => s.error);
  const leaveOnline = useOnline((s) => s.leave);

  const game = useGame((s) => s.game);
  const unlockedFor = useGame((s) => s.unlockedFor);
  const localSend = useGame((s) => s.send);
  const unlockStore = useGame((s) => s.unlock);
  const resetLocal = useGame((s) => s.reset);

  if (onlineStatus !== 'idle') {
    const view = onlineView;
    const pendingPlayer = view?.pending[0]?.playerId ?? null;
    const myTurn = !!pendingPlayer && pendingPlayer === onlineSeat;
    const status = view
      ? `Online · Round ${view.round} · ${
          view.gameOver
            ? 'game over'
            : myTurn
              ? 'your turn'
              : `${nameOf(view, pendingPlayer)} to move`
        }`
      : onlineStatus === 'error'
        ? `Online · ${onlineError ?? 'disconnected'}`
        : 'Online · connecting…';
    return {
      mode: 'online',
      online: true,
      view,
      send: onlineSend,
      pendingShipId: view?.pending[0]?.shipId ?? null,
      myTurn,
      needsUnlock: false,
      unlock: () => undefined,
      statusLabel: status,
      isHost,
      code,
      onlineError,
      leave: leaveOnline,
    };
  }

  if (game) {
    const cp = currentPlayer(game);
    const view = viewFor(game, cp);
    const needsUnlock = cp != null && unlockedFor !== cp && !view.gameOver;
    const myTurn = cp != null && !needsUnlock && !view.gameOver;
    return {
      mode: 'local',
      online: false,
      view,
      send: localSend,
      pendingShipId: view.pending[0]?.shipId ?? null,
      myTurn,
      needsUnlock,
      unlock: () => {
        if (cp) unlockStore(cp);
      },
      statusLabel: `Hot-seat · Round ${view.round} · ${
        view.gameOver ? 'game over' : `${nameOf(view, cp)}'s turn`
      }`,
      isHost: false,
      code: null,
      onlineError: null,
      leave: resetLocal,
    };
  }

  return {
    mode: 'none',
    online: false,
    view: null,
    send: () => undefined,
    pendingShipId: null,
    myTurn: false,
    needsUnlock: false,
    unlock: () => undefined,
    statusLabel: 'No game in progress',
    isHost: false,
    code: null,
    onlineError: null,
    leave: () => undefined,
  };
}
