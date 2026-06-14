import { sideShipInits, type XwsSquad } from '@xwing/data';
import type { Command, GameEvent, Obstacle, PlayerView } from '@xwing/engine';
import { create } from 'zustand';
import { PALETTE } from './colors';
import { getGuestId } from './identity';
import { subscribePush } from './push';
import { type Connection, connect, getSeat, hostGame, joinGame } from './transport';

type Status = 'idle' | 'connecting' | 'lobby' | 'playing' | 'error';

const ACTIVE_KEY = 'xwing:activeGame';

interface ActiveGame {
  code: string;
  isHost: boolean;
}

const remember = (game: ActiveGame | null): void => {
  if (game) localStorage.setItem(ACTIVE_KEY, JSON.stringify(game));
  else localStorage.removeItem(ACTIVE_KEY);
};
const recall = (): ActiveGame | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveGame) : null;
  } catch {
    return null;
  }
};

interface OnlineStore {
  status: Status;
  view: PlayerView | null;
  log: GameEvent[];
  seat: string | null;
  code: string | null;
  isHost: boolean;
  rejection: string | null;
  error: string | null;
  /** Host (player1, bottom) brings their squad + colour and opens the lobby. */
  host: (squad: XwsSquad, obstacles: Obstacle[], color: string) => Promise<void>;
  /** Joiner (player2, top) brings their squad + colour and starts the game. */
  join: (code: string, squad: XwsSquad, color: string) => Promise<void>;
  resume: () => Promise<void>;
  send: (command: Command) => void;
  leave: () => void;
}

let conn: Connection | null = null;
const randomCode = (): string => Math.random().toString(36).slice(2, 8);

export const useOnline = create<OnlineStore>((set, get) => {
  const open = (code: string, guestId: string): Connection =>
    connect(code, guestId, {
      onView: (view, log) => set({ view, log, status: 'playing', rejection: null }),
      onLobby: () => set({ status: 'lobby' }),
      onRejection: (rejection) => set({ rejection }),
      onClose: () => {
        const s = get().status;
        if (s === 'playing' || s === 'lobby') set({ status: 'error', error: 'Disconnected' });
      },
    });

  return {
    status: 'idle',
    view: null,
    log: [],
    seat: null,
    code: null,
    isHost: false,
    rejection: null,
    error: null,

    host: async (squad, obstacles, color) => {
      const guestId = getGuestId();
      const code = randomCode();
      set({
        status: 'connecting',
        code,
        isHost: true,
        seat: 'player1',
        view: null,
        log: [],
        error: null,
        rejection: null,
      });
      await hostGame(
        code,
        'player1',
        sideShipInits(squad, 'player1'),
        String(Date.now()),
        guestId,
        obstacles,
        color,
      );
      remember({ code, isHost: true });
      conn = open(code, guestId);
      void subscribePush(code, guestId);
    },

    join: async (code, squad, color) => {
      const guestId = getGuestId();
      set({
        status: 'connecting',
        code,
        isHost: false,
        view: null,
        log: [],
        error: null,
        rejection: null,
      });
      // joiner takes player2 (top); avoid sharing the host's colour
      const { hostColor } = await getSeat(code, guestId);
      const mine = color !== hostColor ? color : (PALETTE.find((c) => c.hex !== hostColor)?.hex ?? color);
      const res = await joinGame(code, sideShipInits(squad, 'player2'), guestId, mine);
      if (res.error) {
        set({ status: 'error', error: res.error });
        return;
      }
      set({ seat: res.playerId ?? 'player2' });
      remember({ code, isHost: false });
      conn = open(code, guestId);
      void subscribePush(code, guestId);
    },

    resume: async () => {
      const saved = recall();
      if (!saved || get().status !== 'idle') return;
      const guestId = getGuestId();
      const { playerId } = await getSeat(saved.code, guestId);
      if (!playerId) {
        remember(null);
        return;
      }
      set({
        status: 'connecting',
        code: saved.code,
        isHost: saved.isHost,
        seat: playerId,
        view: null,
        log: [],
        error: null,
        rejection: null,
      });
      conn = open(saved.code, guestId);
    },

    send: (command) => conn?.send(command),

    leave: () => {
      conn?.close();
      conn = null;
      remember(null);
      set({
        status: 'idle',
        view: null,
        log: [],
        seat: null,
        code: null,
        isHost: false,
        rejection: null,
        error: null,
      });
    },
  };
});
