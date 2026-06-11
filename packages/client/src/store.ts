import {
  type Command,
  createGame,
  dispatch,
  type Game,
  type GameConfig,
  type PlayerView,
  projectView,
} from '@xwing/engine';
import { create } from 'zustand';

interface GameStore {
  /** null while on the setup screen. */
  game: Game | null;
  /** Which player has "unlocked" the shared device (pass-and-play privacy). */
  unlockedFor: string | null;
  rejection: string | null;
  startGame: (config: GameConfig) => void;
  send: (cmd: Command) => void;
  unlock: (playerId: string) => void;
  reset: () => void;
}

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  unlockedFor: null,
  rejection: null,
  startGame: (config) => set({ game: createGame(config), unlockedFor: null, rejection: null }),
  send: (cmd) => {
    const current = get().game;
    if (!current) return;
    const { game, rejection } = dispatch(current, cmd);
    set({ game, rejection: rejection ?? null });
  },
  unlock: (playerId) => set({ unlockedFor: playerId, rejection: null }),
  reset: () => set({ game: null, unlockedFor: null, rejection: null }),
}));

export const currentPlayer = (g: Game): string | null => g.state.pending[0]?.playerId ?? null;

export const viewFor = (g: Game, playerId: string | null): PlayerView =>
  projectView(g.state, playerId ?? '');
