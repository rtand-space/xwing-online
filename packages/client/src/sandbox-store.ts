import {
  pilotFaction,
  randomObstacles,
  SEAT_COLORS,
  sideShipInits,
  toShipInit,
  type XwsSquad,
} from '@xwing/data';
import {
  applyManeuver,
  type GameConfig,
  type Maneuver,
  type Obstacle,
  type Ship,
  type ShipInit,
} from '@xwing/engine';
import { create } from 'zustand';
import { useGame } from './store';

const norm = (deg: number): number => ((deg % 360) + 360) % 360;

const shipToInit = (s: Ship): ShipInit => ({
  id: s.id,
  ownerId: s.ownerId,
  shipType: s.shipType,
  pilot: s.pilot,
  pilotXws: s.pilotXws,
  upgrades: s.upgrades,
  initiative: s.initiative,
  base: s.base,
  primaryAttack: s.primaryAttack,
  arcs: s.arcs,
  weapons: s.weapons,
  devices: s.devices,
  turretArc: s.turretArc,
  agility: s.agility,
  hull: s.maxHull,
  shields: s.maxShields,
  maxCharges: s.maxCharges,
  recurring: s.recurring,
  pos: s.pos,
  actionBar: s.actionBar,
  actionDifficulty: s.actionDifficulty,
  actionLinks: s.actionLinks,
  dialOptions: s.dialOptions,
});

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
      { x, y: side === 'player1' ? -150 : 150, angle: side === 'player1' ? 0 : 180 },
      id,
    ),
  );
}

interface SandboxState {
  active: boolean;
  /** Turn-based rules running over the current board (reversible). */
  turnBased: boolean;
  ships: Ship[];
  obstacles: Obstacle[];
  selectedId: string | null;
  showArcs: boolean;
  open: () => void;
  exit: () => void;
  clear: () => void;
  enterTurnBased: () => void;
  leaveTurnBased: () => void;
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

/** A sandbox side's display name — the faction of its first ship, else the seat. */
const sideName = (ships: Ship[], side: string): string => {
  const s = ships.find((sh) => sh.ownerId === side);
  return s?.pilotXws
    ? pilotFaction(s.shipType, s.pilotXws)
    : side === 'player1'
      ? 'Player 1'
      : 'Player 2';
};

export const useSandbox = create<SandboxState>((set, get) => ({
  active: false,
  turnBased: false,
  ships: [],
  obstacles: [],
  selectedId: null,
  showArcs: true,
  // Enter the persistent workspace; seed obstacles only the first time, keep the board on return.
  open: () =>
    set((s) => ({
      active: true,
      obstacles: s.obstacles.length ? s.obstacles : randomObstacles(String(Date.now())),
    })),
  exit: () => {
    if (get().turnBased) useGame.getState().reset();
    set({ active: false, turnBased: false, selectedId: null });
  },
  clear: () => set({ ships: [], selectedId: null, obstacles: randomObstacles(String(Date.now())) }),
  enterTurnBased: () => {
    const { ships, obstacles } = get();
    if (ships.length === 0) return;
    const config: GameConfig = {
      id: 'sandbox',
      seed: String(Date.now()),
      players: [
        { id: 'player1', name: sideName(ships, 'player1'), color: SEAT_COLORS.player1 },
        { id: 'player2', name: sideName(ships, 'player2'), color: SEAT_COLORS.player2 },
      ],
      ships: ships.map(shipToInit),
      obstacles,
    };
    useGame.getState().startGame(config);
    set({ turnBased: true, selectedId: null });
  },
  leaveTurnBased: () => {
    const game = useGame.getState().game;
    if (game) {
      const byId = new Map(game.state.ships.map((s) => [s.id, s]));
      set({ ships: get().ships.map((s) => ({ ...s, pos: byId.get(s.id)?.pos ?? s.pos })) });
    }
    useGame.getState().reset();
    set({ turnBased: false, selectedId: null });
  },
  add: (shipXws, pilotXws, side) => {
    const id = `sb-${++counter}`;
    const x = (get().ships.filter((s) => s.ownerId === side).length - 1) * 120;
    set({ ships: [...get().ships, makeShip(shipXws, pilotXws, side, id, x)], selectedId: id });
  },
  addSquad: (squad, side) => {
    const added = sideShipInits(squad, side as 'player1' | 'player2').map((init) =>
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
