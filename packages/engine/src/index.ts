export const ENGINE_VERSION = '0.0.0';

export type {
  ActionType,
  BaseSize,
  Bearing,
  Difficulty,
  GameState,
  Maneuver,
  PendingDecision,
  Phase,
  Player,
  PlayerId,
  Position,
  Rng,
  Ship,
  ShipId,
  Speed,
  Token,
  TokenKind,
} from './types';
export type { Command } from './commands';
export type { DiceKind, GameConfig, GameEvent, ShipInit } from './events';
export type { AttackFace, DefenceFace } from './dice';

export { rollAttack, rollDefence } from './dice';
export { rngAt } from './rng';
export { applyEvent, EMPTY_STATE } from './apply';
export { computePending } from './pending';
export { reduce } from './reduce';
export type { ReduceResult } from './reduce';
export { autoStep } from './phases';
export { buildInitial } from './setup';
export { createGame, dispatch, replay } from './game';
export type { Game } from './game';
export { projectView } from './view';
export type { PlayerView } from './view';
export { demoConfig, tieln, xwing } from './presets';

export {
  BASE_MM,
  basePolygon,
  heading,
  normalizeAngle,
  polygonDistance,
  polygonsOverlap,
} from './geometry';
export type { Vec } from './geometry';
export { applyManeuver, pathAt } from './templates';
export { baseDistance, bearingDeg, inArc, RANGE_BAND_MM, rangeBand } from './arcs';
export { resolveMovement } from './movement';
export type { MovementResult } from './movement';
