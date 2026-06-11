import {
  type Command,
  createGame,
  dispatch,
  type Game,
  type GameConfig,
  type GameEvent,
  type PlayerView,
  projectView,
  replay,
} from '@xwing/engine';
import { create } from 'zustand';

const LOG_KEY = 'xwing:localLog';

const saveLocal = (game: Game | null): void => {
  if (game) localStorage.setItem(LOG_KEY, JSON.stringify(game.log));
  else localStorage.removeItem(LOG_KEY);
};
const loadLocal = (): Game | null => {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return null;
    const log = JSON.parse(raw) as GameEvent[];
    return { state: replay(log), log };
  } catch {
    return null;
  }
};

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
  game: loadLocal(),
  unlockedFor: null,
  rejection: null,
  startGame: (config) => {
    const game = createGame(config);
    saveLocal(game);
    set({ game, unlockedFor: null, rejection: null });
  },
  send: (cmd) => {
    const current = get().game;
    if (!current) return;
    const { game, rejection } = dispatch(current, cmd);
    saveLocal(game);
    set({ game, rejection: rejection ?? null });
  },
  unlock: (playerId) => set({ unlockedFor: playerId, rejection: null }),
  reset: () => {
    saveLocal(null);
    set({ game: null, unlockedFor: null, rejection: null });
  },
}));

export const currentPlayer = (g: Game): string | null => g.state.pending[0]?.playerId ?? null;

export const viewFor = (g: Game, playerId: string | null): PlayerView =>
  projectView(g.state, playerId ?? '');
