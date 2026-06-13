import type { BaseSize, Bearing, Maneuver, Ship, TokenKind } from './types';

/** Green tokens a jam strips / a lock counts among (focus, evade, lock, calculate,
 *  reinforce). Locks are green but not circular, so they survive the End Phase. */
export const GREEN_TOKENS: TokenKind[] = ['focus', 'evade', 'lock', 'calculate', 'reinforce'];

/** Circular tokens cleared in the End Phase (green then orange). Red circular
 *  tokens (stress/strain/ion) and the non-circular lock are not cleared here. */
export const END_PHASE_CLEARED: TokenKind[] = [
  'focus',
  'evade',
  'calculate',
  'reinforce',
  'tractor',
  'disarm',
  'jam',
];

/** Tokens needed to ionise / tractor a ship, by base size (RR: small 1, med 2, large 3). */
const THRESHOLD: Record<BaseSize, number> = { small: 1, medium: 2, large: 3 };

export const countToken = (s: Ship, kind: TokenKind): number =>
  s.tokens.filter((t) => t.kind === kind).length;

export const hasToken = (s: Ship, kind: TokenKind): boolean => s.tokens.some((t) => t.kind === kind);

/** A ship is ionised / tractored once that token meets its base-size threshold. */
export const isIonized = (s: Ship): boolean => countToken(s, 'ion') >= THRESHOLD[s.base];
export const isTractored = (s: Ship): boolean => countToken(s, 'tractor') >= THRESHOLD[s.base];

/** A ship is cloaked while it holds a cloak token. */
export const isCloaked = (s: Ship): boolean => hasToken(s, 'cloak');

/** A disarmed ship cannot perform attacks; a cloaked ship is also disarmed. */
export const isDisarmed = (s: Ship): boolean => hasToken(s, 'disarm') || isCloaked(s);

/** Defence dice added while defending: cloak grants +2 agility. */
export const agilityBonus = (s: Ship): number => (isCloaked(s) ? 2 : 0);

/** Defence dice removed while defending: tractored (1) plus strained (1). */
export const defencePenalty = (s: Ship): number =>
  (isTractored(s) ? 1 : 0) + (hasToken(s, 'strain') ? 1 : 0);

/** The forced ion maneuver: a blue speed-1 straight/bank in the dial's direction
 *  (a stop or any non-turning bearing becomes a 1-straight). */
export function ionManeuver(dial?: Maneuver): Maneuver {
  const b = dial?.bearing ?? 'straight';
  const bearing: Bearing = b.includes('left')
    ? 'bank-left'
    : b.includes('right')
      ? 'bank-right'
      : 'straight';
  return { speed: 1, bearing, difficulty: 'blue' };
}
