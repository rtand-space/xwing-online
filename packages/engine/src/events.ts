import type { AttackFace, DefenceFace } from './dice';
import type {
  ActionType,
  BaseSize,
  GameWindow,
  Maneuver,
  Obstacle,
  ObstacleKind,
  Phase,
  Player,
  PlayerId,
  Position,
  ShipArc,
  ShipId,
  TokenKind,
  TurretFacing,
} from './types';

export interface ShipInit {
  id: ShipId;
  ownerId: PlayerId;
  shipType: string;
  pilot: string;
  pilotXws?: string;
  upgrades?: string[];
  initiative: number;
  base: BaseSize;
  primaryAttack: number;
  arcs?: ShipArc[];
  turretArc?: TurretFacing;
  agility: number;
  hull: number;
  shields: number;
  charges?: number;
  maxCharges?: number;
  recurring?: number;
  force?: number;
  maxForce?: number;
  forceRecovers?: number;
  upgradeCharges?: Record<string, { charges: number; max: number; recovers: number }>;
  pos: Position;
  actionBar: ActionType[];
  dialOptions: Maneuver[];
}

export interface GameConfig {
  id: string;
  seed: string;
  players: Player[];
  ships: ShipInit[];
  obstacles?: Obstacle[];
}

export type DiceKind = 'attack' | 'defence';

/** Immutable facts. The append-only log of these is the source of truth. */
export type GameEvent =
  | { type: 'GameCreated'; config: GameConfig }
  | { type: 'DialSet'; shipId: ShipId; maneuver: Maneuver }
  | { type: 'DialRevealed'; shipId: ShipId; maneuver: Maneuver }
  | { type: 'ShipMoved'; shipId: ShipId; maneuver: Maneuver; to: Position; bumped?: boolean }
  | { type: 'Decloaked'; shipId: ShipId; to: Position }
  | { type: 'DecloakPassed'; shipId: ShipId }
  | { type: 'ObstacleHit'; shipId: ShipId; obstacleId: string; kind: ObstacleKind }
  | { type: 'StressChanged'; shipId: ShipId; delta: number }
  | { type: 'ChargeChanged'; shipId: ShipId; delta: number; source?: string }
  | { type: 'ForceChanged'; shipId: ShipId; delta: number }
  | { type: 'ActionPerformed'; shipId: ShipId; action: ActionType; targetId?: ShipId }
  | { type: 'ActionSkipped'; shipId: ShipId }
  | { type: 'ArcRotated'; shipId: ShipId; to: TurretFacing }
  | { type: 'TokenGained'; shipId: ShipId; kind: TokenKind; targetId?: ShipId }
  | { type: 'AttackDeclared'; shipId: ShipId; targetId: ShipId; range: number }
  | { type: 'DiceRolled'; kind: DiceKind; shipId: ShipId; faces: (AttackFace | DefenceFace)[] }
  | { type: 'TokenSpent'; shipId: ShipId; kind: TokenKind; targetId?: ShipId }
  | {
      type: 'DamageDealt';
      shipId: ShipId;
      amount: number;
      shieldsAfter: number;
      hullAfter: number;
      crits: number;
    }
  | { type: 'ShipDestroyed'; shipId: ShipId }
  | { type: 'AttackPassed'; shipId: ShipId }
  | {
      type: 'AbilityOffered';
      shipId: ShipId;
      abilityXws: string;
      window: GameWindow;
      label: string;
    }
  | { type: 'AbilityResolved' }
  | { type: 'RoundEnded' }
  | { type: 'PhaseAdvanced'; to: Phase };
