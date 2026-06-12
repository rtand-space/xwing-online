import { randomObstacles, sideShipInits, toShipInit, type XwsSquad } from '@xwing/data';
import {
  applyManeuver,
  type Maneuver,
  type Obstacle,
  type Ship,
  type ShipInit,
} from '@xwing/engine';
import { create } from 'zustand';

const norm = (deg: number): number => ((deg % 360) + 360) % 360;

function initToShip(init: ShipInit): Ship {
  return {
    ...init,
    upgrades: init.upgrades ?? [],
    maxHull: init.hull,
    maxShields: init.shields,
    maxCharges: init.maxCharges ?? 0,
    charges: init.charges ?? init.maxCharges ?? 0,
    recurring: init.recurring ?? 0,
    tokens: [],
    dialRevealed: false,
    hasMoved: false,
    hasActed: false,
    hasEngaged: false,
  };
}

function makeShip(shipXws: string, pilotXws: string, side: string, id: string, x: number): Ship {
  return initToShip(
    toShipInit(
      shipXws,
      pilotXws,
      side,
      { x, y: side === 'rebel' ? -150 : 150, angle: side === 'rebel' ? 0 : 180 },
      id,
    ),
  );
}

interface SandboxState {
  active: boolean;
  ships: Ship[];
  obstacles: Obstacle[];
  selectedId: string | null;
  showArcs: boolean;
  open: () => void;
  exit: () => void;
  add: (shipXws: string, pilotXws: string, side: string) => void;
  addSquad: (squad: XwsSquad, side: string) => void;
  select: (id: string | null) => void;
  move: (id: string, x: number, y: number) => void;
  rotate: (deg: number) => void;
  execute: (m: Maneuver) => void;
  remove: () => void;
  toggleArcs: () => void;
}

let counter = 0;

export const useSandbox = create<SandboxState>((set, get) => ({
  active: false,
  ships: [],
  obstacles: [],
  selectedId: null,
  showArcs: true,
  open: () =>
    set({
      active: true,
      ships: [],
      obstacles: randomObstacles(String(Date.now())),
      selectedId: null,
    }),
  exit: () => set({ active: false, ships: [], selectedId: null }),
  add: (shipXws, pilotXws, side) => {
    const id = `sb-${++counter}`;
    const x = (get().ships.filter((s) => s.ownerId === side).length - 1) * 120;
    set({ ships: [...get().ships, makeShip(shipXws, pilotXws, side, id, x)], selectedId: id });
  },
  addSquad: (squad, side) => {
    const added = sideShipInits(squad, side as 'rebel' | 'imperial').map((init) =>
      initToShip({ ...init, id: `sb-${++counter}` }),
    );
    set({ ships: [...get().ships, ...added], selectedId: added.at(-1)?.id ?? get().selectedId });
  },
  select: (id) => set({ selectedId: id }),
  move: (id, x, y) =>
    set({ ships: get().ships.map((s) => (s.id === id ? { ...s, pos: { ...s.pos, x, y } } : s)) }),
  rotate: (deg) => {
    const id = get().selectedId;
    if (!id) return;
    set({
      ships: get().ships.map((s) =>
        s.id === id ? { ...s, pos: { ...s.pos, angle: norm(s.pos.angle + deg) } } : s,
      ),
    });
  },
  execute: (m) => {
    const id = get().selectedId;
    if (!id) return;
    set({
      ships: get().ships.map((s) =>
        s.id === id ? { ...s, pos: applyManeuver(s.pos, m, s.base) } : s,
      ),
    });
  },
  remove: () => {
    const id = get().selectedId;
    if (!id) return;
    set({ ships: get().ships.filter((s) => s.id !== id), selectedId: null });
  },
  toggleArcs: () => set({ showArcs: !get().showArcs }),
}));
