import {
  type Command,
  createGame,
  demoConfig,
  dispatch,
  type Game,
  type PlayerView,
  projectView,
} from '@xwing/engine';
import { create } from 'zustand';

interface GameStore {
  game: Game;
  /** Which player has "unlocked" the shared device (pass-and-play privacy). */
  unlockedFor: string | null;
  rejection: string | null;
  send: (cmd: Command) => void;
  unlock: (playerId: string) => void;
  reset: () => void;
}

const fresh = (): Game => createGame(demoConfig(String(Date.now())));

export const useGame = create<GameStore>((set, get) => ({
  game: fresh(),
  unlockedFor: null,
  rejection: null,
  send: (cmd) => {
    const { game, rejection } = dispatch(get().game, cmd);
    set({ game, rejection: rejection ?? null });
  },
  unlock: (playerId) => set({ unlockedFor: playerId, rejection: null }),
  reset: () => set({ game: fresh(), unlockedFor: null, rejection: null }),
}));

export const currentPlayer = (g: Game): string | null => g.state.pending[0]?.playerId ?? null;

export const viewFor = (g: Game, playerId: string | null): PlayerView =>
  projectView(g.state, playerId ?? '');
