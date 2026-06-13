export type PlayerId = string;
export type ShipId = string;

/** Board coordinates in real-world millimetres (matches the tabletop). */
export interface Position {
  x: number;
  y: number;
  /** Facing in degrees. Geometry is fleshed out in M2. */
  angle: number;
}

export type BaseSize = 'small' | 'medium' | 'large';

export type Bearing =
  | 'straight'
  | 'bank-left'
  | 'bank-right'
  | 'turn-left'
  | 'turn-right'
  | 'koiogran'
  | 'segnors-loop-left'
  | 'segnors-loop-right'
  | 'tallon-roll-left'
  | 'tallon-roll-right'
  | 'reverse-straight'
  | 'reverse-bank-left'
  | 'reverse-bank-right'
  | 'stationary';

export type Difficulty = 'blue' | 'white' | 'red' | 'purple';

export type Speed = 0 | 1 | 2 | 3 | 4 | 5;

export interface Maneuver {
  speed: Speed;
  bearing: Bearing;
  difficulty: Difficulty;
}

export type ActionType =
  | 'focus'
  | 'lock'
  | 'barrel-roll'
  | 'boost'
  | 'evade'
  | 'calculate'
  | 'reinforce'
  | 'cloak'
  | 'rotate-arc';

/** A primary-weapon firing arc and its attack value. */
export type ArcKind =
  | 'front'
  | 'rear'
  | 'full-front'
  | 'bullseye'
  | 'single-turret'
  | 'double-turret';

/** Where a rotatable (single/double) turret indicator points. */
export type TurretFacing = 'front' | 'right' | 'rear' | 'left';

export interface ShipArc {
  kind: ArcKind;
  value: number;
}

/** A legal destination for a boost/barrel-roll reposition. */
export interface RepositionCandidate {
  label: string;
  to: Position;
}

export type TokenKind =
  | 'focus'
  | 'evade'
  | 'stress'
  | 'lock'
  | 'calculate'
  | 'reinforce'
  | 'ion'
  | 'tractor'
  | 'disarm'
  | 'strain'
  | 'jam'
  | 'cloak';

export interface Token {
  kind: TokenKind;
  /** Present for locks: the ship this token is trained on. */
  targetId?: ShipId;
}

export type Phase = 'planning' | 'system' | 'activation' | 'engagement' | 'end';

/** Non-combat ability timing windows fired by the phase FSM. */
export type GameWindow = 'afterReveal' | 'afterMove' | 'onPerformAction' | 'onRoundEnd';

/** A pending optional ("may") ability awaiting its owner's choice. */
export interface AbilityOffer {
  shipId: ShipId;
  abilityXws: string;
  window: GameWindow;
  label: string;
}

export interface Player {
  id: PlayerId;
  name: string;
}

export interface Ship {
  id: ShipId;
  ownerId: PlayerId;
  /** xws-style id (e.g. 't65xwing'); stats come from @xwing/data later. */
  shipType: string;
  pilot: string;
  /** Pilot xws id — keys pilot abilities in the R3 registry. */
  pilotXws?: string;
  /** Equipped upgrade xws ids — key upgrade abilities. */
  upgrades?: string[];
  initiative: number;
  base: BaseSize;
  /** Front-arc attack value; the default when `arcs` is absent. */
  primaryAttack: number;
  /** Primary-weapon firing arcs from card stats; defaults to a single front arc. */
  arcs?: ShipArc[];
  /** Current orientation of a rotatable (single/double) turret indicator. */
  turretArc?: TurretFacing;
  agility: number;
  hull: number;
  shields: number;
  maxHull: number;
  maxShields: number;
  /** Intrinsic (ship/pilot) charge pool: current/most + round-end recovery. */
  charges: number;
  maxCharges: number;
  recurring: number;
  /** Per-upgrade charge pools, keyed by upgrade xws — kept separate so one card
   *  can't spend another's charges. */
  upgradeCharges?: Record<string, { charges: number; max: number; recovers: number }>;
  /** Force pool (R4): current/most, plus how many recover at round end. */
  force?: number;
  maxForce?: number;
  forceRecovers?: number;
  pos: Position;
  actionBar: ActionType[];
  dialOptions: Maneuver[];
  tokens: Token[];
  dial?: Maneuver;
  dialRevealed: boolean;
  /** Per-round activation/engagement bookkeeping; reset at RoundEnded. */
  hasMoved: boolean;
  hasActed: boolean;
  hasEngaged: boolean;
  /** Whether the ship has taken its System-Phase opportunity (e.g. decloak). */
  hasSystemActed?: boolean;
}

export interface Rng {
  seed: string;
  /** Number of dice drawn so far; the only mutable RNG state. */
  cursor: number;
}

export type PendingDecision =
  | {
      type: 'set-dial';
      playerId: PlayerId;
      shipId: ShipId;
      options: { maneuvers: Maneuver[] };
    }
  | { type: 'execute-maneuver'; playerId: PlayerId; shipId: ShipId }
  | {
      type: 'perform-action';
      playerId: PlayerId;
      shipId: ShipId;
      options: { actions: ActionType[]; lockTargets: ShipId[]; canSkip: boolean };
    }
  | {
      type: 'declare-attack';
      playerId: PlayerId;
      shipId: ShipId;
      options: { targets: ShipId[]; canPass: boolean };
    }
  | {
      type: 'trigger-ability';
      playerId: PlayerId;
      shipId: ShipId;
      options: { abilityXws: string; label: string };
    }
  | { type: 'decloak'; playerId: PlayerId; shipId: ShipId; options: { canSkip: boolean } }
  | {
      type: 'reposition';
      playerId: PlayerId;
      shipId: ShipId;
      options: { action: 'boost' | 'barrel-roll'; candidates: RepositionCandidate[] };
    };

/** Obstacle kinds with engine support today (gas clouds need strain/ion tokens — later). */
export type ObstacleKind = 'asteroid' | 'debris';

export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  /** Centre; angle is cosmetic (token rotation). */
  pos: Position;
  /** Collision radius in millimetres. */
  radius: number;
}

export interface GameState {
  id: string;
  rng: Rng;
  round: number;
  phase: Phase;
  players: Player[];
  ships: Ship[];
  obstacles: Obstacle[];
  /** A pending optional ability awaiting its owner's use/skip; pauses the FSM. */
  offer?: AbilityOffer;
  /** A boost/barrel-roll mid-resolution, awaiting the placement choice; pauses the FSM. */
  reposition?: { shipId: ShipId; action: 'boost' | 'barrel-roll'; candidates: RepositionCandidate[] };
  pending: PendingDecision[];
  gameOver: boolean;
}
