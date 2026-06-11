import type { Bearing, Difficulty, Maneuver, Speed } from '@xwing/engine';

/** xwing-data2 bearing codes → engine bearings (R1 subset; others are ignored). */
const BEARINGS: Record<string, Bearing> = {
  F: 'straight',
  B: 'bank-left',
  N: 'bank-right',
  T: 'turn-left',
  Y: 'turn-right',
  K: 'koiogran',
  O: 'stationary',
};

const DIFFICULTIES: Record<string, Difficulty> = { W: 'white', B: 'blue', R: 'red' };

/** Parse one dial code like "4KR"; returns null for unsupported bearings. */
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
