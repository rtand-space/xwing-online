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

export type ActionType = 'focus' | 'lock' | 'barrel-roll' | 'boost' | 'evade';

export type TokenKind = 'focus' | 'evade' | 'stress' | 'lock';

export interface Token {
  kind: TokenKind;
  /** Present for locks: the ship this token is trained on. */
  targetId?: ShipId;
}

export type Phase = 'planning' | 'system' | 'activation' | 'engagement' | 'end';

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
  primaryAttack: number;
  agility: number;
  hull: number;
  shields: number;
  maxHull: number;
  maxShields: number;
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
  pending: PendingDecision[];
  gameOver: boolean;
}
