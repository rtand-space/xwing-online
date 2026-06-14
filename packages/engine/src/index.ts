export const ENGINE_VERSION = '0.0.0';

export type {
  ActionLink,
  ActionType,
  ArcKind,
  BaseSize,
  CombatState,
  SpendKind,
  Bearing,
  Difficulty,
  GameState,
  Maneuver,
  Obstacle,
  ObstacleKind,
  PendingDecision,
  Phase,
  Player,
  PlayerId,
  Position,
  Rng,
  DamageCard,
  DamageEffect,
  Device,
  DevicePlacement,
  Ship,
  ShipArc,
  ShipDevice,
  ShipId,
  ShipWeapon,
  Speed,
  Token,
  TokenKind,
  TurretFacing,
} from './types';
export type { Command } from './commands';
export type { DiceKind, GameConfig, GameEvent, ShipInit } from './events';
export type { AttackFace, DefenceFace } from './dice';

export { rollAttack, rollDefence } from './dice';
export { rngAt } from './rng';
export { applyEvent, EMPTY_STATE } from './apply';
export { computePending } from './pending';
export { reduce, trivialCommand } from './reduce';
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
export {
  attackValue,
  baseDistance,
  bearingDeg,
  hasTurret,
  inArc,
  inArcAt,
  inBullseye,
  inRange,
  nextFacing,
  RANGE_BAND_MM,
  arcFacings,
  rangeBand,
  shipArcs,
} from './arcs';
export { resolveMovement } from './movement';
export type { MovementResult } from './movement';
export { repositionCandidates } from './reposition';
export {
  agilityBonus,
  countToken,
  defencePenalty,
  END_PHASE_CLEARED,
  GREEN_TOKENS,
  hasToken,
  ionManeuver,
  isCloaked,
  isDisarmed,
  isIonized,
  isTractored,
} from './tokens';
export { lineObstructed, obstacleMoveEvents, obstaclesAt } from './obstacles';
export { ATTACK_WINDOWS, resolveAttack } from './combat';
export type { AttackContext, AttackHook, AttackWindow } from './combat';
export {
  clearAbilities,
  effectiveInitiative,
  findOffer,
  fireWindow,
  gatherAttackHooks,
  getAbility,
  registerAbility,
  resolveOptional,
  shipAbilitySources,
} from './abilities';
export type {
  Ability,
  AttackAbilityHook,
  GameAbilityHook,
  GameContext,
  GameWindow,
  OptionalAbility,
  OptionalAttackHook,
} from './abilities';
export {
  addAttackDice,
  addDefenceDice,
  addStress,
  changeAttack,
  changeDefence,
  chargesFrom,
  friendliesInRange,
  gainToken,
  offerActionGrant,
  offerBonusAttack,
  offerTargetEffect,
  recoverCharge,
  rerollAttack,
  rerollDefence,
  spendCharge,
  spendForce,
} from './effects';
