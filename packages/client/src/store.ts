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
  trivialCommand,
} from '@xwing/engine';
import { create } from 'zustand';

const LOG_KEY = 'xwing:localLog';

/** Auto-apply steps that have only one legal option (no target → pass, no action
 *  → skip, nothing to spend → proceed) so players aren't prompted for non-choices. */
const autoResolve = (game: Game): Game => {
  let g = game;
  for (let i = 0; i < 500; i++) {
    const p = g.state.pending[0];
    const cmd = p && trivialCommand(p);
    if (!cmd) break;
    const next = dispatch(g, cmd).game;
    if (next === g) break;
    g = next;
  }
  return g;
};

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
    const game = autoResolve(createGame(config));
    saveLocal(game);
    set({ game, unlockedFor: null, rejection: null });
  },
  send: (cmd) => {
    const current = get().game;
    if (!current) return;
    const { game, rejection } = dispatch(current, cmd);
    const resolved = rejection ? game : autoResolve(game);
    saveLocal(resolved);
    set({ game: resolved, rejection: rejection ?? null });
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
