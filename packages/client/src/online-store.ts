import type { Command, GameConfig, PlayerView } from '@xwing/engine';
import { create } from 'zustand';
import { getGuestId } from './identity';
import { type Connection, connect, hostGame, joinGame } from './transport';

type Status = 'idle' | 'connecting' | 'playing' | 'error';

interface OnlineStore {
  status: Status;
  view: PlayerView | null;
  seat: string | null;
  code: string | null;
  isHost: boolean;
  rejection: string | null;
  error: string | null;
  host: (config: GameConfig) => Promise<void>;
  join: (code: string) => Promise<void>;
  send: (command: Command) => void;
  leave: () => void;
}

let conn: Connection | null = null;
const randomCode = (): string => Math.random().toString(36).slice(2, 8);

export const useOnline = create<OnlineStore>((set, get) => {
  const open = (code: string, guestId: string): Connection =>
    connect(code, guestId, {
      onView: (view) => set({ view, status: 'playing', rejection: null }),
      onRejection: (rejection) => set({ rejection }),
      onClose: () => {
        if (get().status === 'playing') set({ status: 'error', error: 'Disconnected' });
      },
    });

  return {
    status: 'idle',
    view: null,
    seat: null,
    code: null,
    isHost: false,
    rejection: null,
    error: null,

    host: async (config) => {
      const guestId = getGuestId();
      const code = randomCode();
      set({ status: 'connecting', code, isHost: true, view: null, error: null, rejection: null });
      const { playerId } = await hostGame(code, { ...config, id: code }, guestId);
      set({ seat: playerId });
      conn = open(code, guestId);
    },

    join: async (code) => {
      const guestId = getGuestId();
      set({ status: 'connecting', code, isHost: false, view: null, error: null, rejection: null });
      const res = await joinGame(code, guestId);
      if (res.error) {
        set({ status: 'error', error: res.error });
        return;
      }
      set({ seat: res.playerId ?? null });
      conn = open(code, guestId);
    },

    send: (command) => conn?.send(command),

    leave: () => {
      conn?.close();
      conn = null;
      set({
        status: 'idle',
        view: null,
        seat: null,
        code: null,
        isHost: false,
        rejection: null,
        error: null,
      });
    },
  };
});
