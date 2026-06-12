import { randomObstacles } from '@xwing/data';
import type { Obstacle } from '@xwing/engine';
import { create } from 'zustand';

/** Pre-game obstacle placement: holds the editable layout and the deferred start. */
interface SetupState {
  active: boolean;
  obstacles: Obstacle[];
  start: ((obstacles: Obstacle[]) => void) | null;
  begin: (seed: string, start: (obstacles: Obstacle[]) => void) => void;
  move: (id: string, x: number, y: number) => void;
  shuffle: () => void;
  confirm: () => void;
  cancel: () => void;
}

export const useSetup = create<SetupState>((set, get) => ({
  active: false,
  obstacles: [],
  start: null,
  begin: (seed, start) => set({ active: true, obstacles: randomObstacles(seed), start }),
  move: (id, x, y) =>
    set({
      obstacles: get().obstacles.map((o) => (o.id === id ? { ...o, pos: { ...o.pos, x, y } } : o)),
    }),
  shuffle: () => set({ obstacles: randomObstacles(String(Date.now())) }),
  confirm: () => {
    const { start, obstacles } = get();
    start?.(obstacles);
    set({ active: false, start: null, obstacles: [] });
  },
  cancel: () => set({ active: false, start: null, obstacles: [] }),
}));
