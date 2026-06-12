import type { Bearing, Difficulty, Maneuver, Speed } from '@xwing/engine';

/** xwing-data2 bearing codes (position 1) → engine bearings — the full vocabulary. */
const BEARINGS: Record<string, Bearing> = {
  F: 'straight',
  B: 'bank-left',
  N: 'bank-right',
  T: 'turn-left',
  Y: 'turn-right',
  K: 'koiogran',
  L: 'segnors-loop-left',
  P: 'segnors-loop-right',
  E: 'tallon-roll-left',
  R: 'tallon-roll-right',
  S: 'reverse-straight',
  A: 'reverse-bank-left',
  D: 'reverse-bank-right',
  O: 'stationary',
};

/** xwing-data2 difficulty codes (position 2) → engine difficulties. */
const DIFFICULTIES: Record<string, Difficulty> = {
  W: 'white',
  B: 'blue',
  R: 'red',
  P: 'purple',
};

/** Parse one dial code like "4KR"; returns null only for malformed codes. */
export function parseManeuver(code: string): Maneuver | null {
  const speed = Number(code[0]) as Speed;
  const bearing = BEARINGS[code[1] ?? ''];
  const difficulty = DIFFICULTIES[code[2] ?? ''];
  if (Number.isNaN(speed) || !bearing || !difficulty) return null;
  return { speed, bearing, difficulty };
}

export function parseDial(codes: string[]): Maneuver[] {
  return codes.map(parseManeuver).filter((m): m is Maneuver => m !== null);
}
