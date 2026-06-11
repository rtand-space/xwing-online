import { rngAt } from './rng';

export type AttackFace = 'hit' | 'crit' | 'focus' | 'blank';
export type DefenceFace = 'evade' | 'focus' | 'blank';

// Real 8-sided distributions.
const ATTACK_TABLE: AttackFace[] = [
  'crit',
  'hit',
  'hit',
  'hit',
  'focus',
  'focus',
  'blank',
  'blank',
];
const DEFENCE_TABLE: DefenceFace[] = [
  'evade',
  'evade',
  'evade',
  'focus',
  'focus',
  'blank',
  'blank',
  'blank',
];

function rollFace<T>(table: T[], seed: string, index: number): T {
  return table[Math.floor(rngAt(seed, index) * table.length)]!;
}

export function rollAttack(seed: string, cursor: number, count: number): AttackFace[] {
  return Array.from({ length: count }, (_, i) => rollFace(ATTACK_TABLE, seed, cursor + i));
}

export function rollDefence(seed: string, cursor: number, count: number): DefenceFace[] {
  return Array.from({ length: count }, (_, i) => rollFace(DEFENCE_TABLE, seed, cursor + i));
}
