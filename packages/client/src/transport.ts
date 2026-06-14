import type { Command, GameEvent, Obstacle, PlayerView, ShipInit } from '@xwing/engine';

export const SERVER = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787';
const WS = SERVER.replace(/^http/, 'ws');

/** Open a lobby with the host's side + ships; the game starts once the joiner brings theirs. */
export async function hostGame(
  code: string,
  side: string,
  ships: ShipInit[],
  seed: string,
  guestId: string,
  obstacles: Obstacle[],
  color: string,
): Promise<{ playerId: string | null }> {
  const r = await fetch(`${SERVER}/games/${code}`, {
    method: 'POST',
    body: JSON.stringify({ guestId, side, ships, seed, obstacles, color }),
  });
  return r.json() as Promise<{ playerId: string | null }>;
}

/** Join a lobby with the opposing side's ships; the server assembles + starts the game. */
export async function joinGame(
  code: string,
  ships: ShipInit[],
  guestId: string,
  color: string,
): Promise<{ playerId?: string; error?: string }> {
  const r = await fetch(`${SERVER}/games/${code}/join`, {
    method: 'POST',
    body: JSON.stringify({ guestId, ships, color }),
  });
  return r.json() as Promise<{ playerId?: string; error?: string }>;
}

export async function getSeat(
  code: string,
  guestId: string,
): Promise<{ playerId: string | null; hostColor?: string | null }> {
  const r = await fetch(`${SERVER}/games/${code}/seat?guestId=${encodeURIComponent(guestId)}`);
  return r.json() as Promise<{ playerId: string | null; hostColor?: string | null }>;
}

export interface Connection {
  send: (command: Command) => void;
  close: () => void;
}

interface Handlers {
  onView: (view: PlayerView, log: GameEvent[]) => void;
  onLobby: () => void;
  onRejection: (message: string) => void;
  onClose: () => void;
}

export function connect(code: string, guestId: string, handlers: Handlers): Connection {
  const ws = new WebSocket(`${WS}/games/${code}/ws?guestId=${encodeURIComponent(guestId)}`);
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data as string) as {
      type: string;
      view?: PlayerView;
      log?: GameEvent[];
      rejection?: string;
    };
    if (msg.type === 'view' && msg.view) handlers.onView(msg.view, msg.log ?? []);
    else if (msg.type === 'lobby') handlers.onLobby();
    else if (msg.type === 'rejection' && msg.rejection) handlers.onRejection(msg.rejection);
  });
  ws.addEventListener('close', handlers.onClose);
  return {
    send: (command) => ws.send(JSON.stringify({ type: 'command', command })),
    close: () => ws.close(),
  };
}
