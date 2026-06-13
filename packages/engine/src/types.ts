import type { AttackFace, DefenceFace } from './dice';

export type PlayerId = string;
export type ShipId = string;

/** Optional dice modifications a player may apply during an attack. */
export type SpendKind = 'focus' | 'lock' | 'calculate' | 'force';

/** An attack mid-resolution: dice are rolled and the owner of the current step
 *  may apply optional spends before it proceeds. */
export interface CombatState {
  attackerId: ShipId;
  targetId: ShipId;
  range: number;
  obstructed: boolean;
  attack: AttackFace[];
  defence: DefenceFace[];
  /** Whose modify step is open: the attacker's, the defender's, then the attacker
   *  again for cost abilities that modify the defender's dice (e.g. Crack Shot). */
  step: 'attack' | 'defence' | 'after-defence';
  /** Set once a result has been changed; rerolls are then no longer offered. */
  changed?: boolean;
  /** Optional abilities already used this attack (offered at most once each). */
  usedAbilities?: string[];
}

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
  | 'rotate-arc'
  | 'jam'
  | 'reload'
  | 'coordinate'
  | 'slam';

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

/** A follow-up action that may be performed immediately after a base action. */
export interface ActionLink {
  action: ActionType;
  difficulty: Difficulty;
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
  | 'deplete'
  | 'jam'
  | 'cloak';

export interface Token {
  kind: TokenKind;
  /** Present for locks: the ship this token is trained on. */
  targetId?: ShipId;
}

export type Phase = 'planning' | 'system' | 'activation' | 'engagement' | 'end';

/** Ability timing windows fired by the phase/combat FSM. */
export type GameWindow =
  | 'afterReveal'
  | 'afterMove'
  | 'onPerformAction'
  | 'onRoundEnd'
  // reactive windows fired when an attack resolves:
  | 'afterAttack' // the attacker, after performing the attack
  | 'afterDefend' // the defender, after defending
  | 'onDamaged' // the defender, when it suffered damage
  | 'onShieldLost' // the defender, when it lost at least one shield
  | 'onDestroyed'; // a living friendly of a destroyed ship

/** A pending optional ("may") ability awaiting its owner's choice. */
export interface AbilityOffer {
  shipId: ShipId;
  abilityXws: string;
  window: GameWindow;
  label: string;
  /** The attacker, for a defender's reactive-window ability (e.g. return fire). */
  attackerId?: ShipId;
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
  /** Per-action difficulty (red → stress, purple → spend Force); white if absent. */
  actionDifficulty?: Partial<Record<ActionType, Difficulty>>;
  /** Per-action linked follow-up actions (perform B right after A). */
  actionLinks?: Partial<Record<ActionType, ActionLink>>;
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
      options: {
        actions: ActionType[];
        lockTargets: ShipId[];
        jamTargets: ShipId[];
        coordinateTargets: ShipId[];
        /** True when this is a free action granted by a coordinate, not the
         *  ship's own activation action. */
        granted?: boolean;
        canSkip: boolean;
      };
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
      options: { action: 'boost' | 'barrel-roll' | 'slam'; candidates: RepositionCandidate[] };
    }
  | {
      type: 'grant-target';
      playerId: PlayerId;
      shipId: ShipId;
      options: { candidates: ShipId[]; canSkip: boolean };
    }
  | {
      type: 'modify';
      playerId: PlayerId;
      shipId: ShipId;
      options: {
        step: 'attack' | 'defence' | 'after-defence';
        spends: SpendKind[];
        abilities: { xws: string; label: string }[];
      };
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
  reposition?: {
    shipId: ShipId;
    action: 'boost' | 'barrel-roll' | 'slam';
    candidates: RepositionCandidate[];
  };
  /** An ability offering to grant a friendly ship an action; awaiting the granter's
   *  target choice (or decline); pauses the FSM. */
  grantOffer?: { granterId: ShipId; candidates: ShipId[]; spendForce: boolean };
  /** A free action granted by a coordinate or ability, awaiting that ship's choice. */
  grantedAction?: { shipId: ShipId };
  /** A linked follow-up action offered after a base action; pauses the FSM. */
  linkedAction?: { shipId: ShipId; action: ActionType; difficulty: Difficulty };
  /** An attack mid-resolution, paused for the current step's optional spends. */
  combat?: CombatState;
  /** A bonus attack granted to a ship (optionally restricted to certain targets),
   *  awaiting its declaration; reuses the normal attack flow but doesn't count as
   *  the ship's engagement. */
  bonusAttack?: { shipId: ShipId; targets?: ShipId[] };
  pending: PendingDecision[];
  gameOver: boolean;
}
