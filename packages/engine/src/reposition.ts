import { BASE_MM } from './geometry';
import { collides } from './movement';
import { applyManeuver } from './templates';
import type { GameState, Maneuver, Position, RepositionCandidate, Ship } from './types';

const DEG = Math.PI / 180;

/** Slide the ship sideways in its own frame (no facing change). */
function lateral(pos: Position, dxLocal: number): Position {
  const a = pos.angle * DEG;
  const right = { x: Math.cos(a), y: -Math.sin(a) };
  return { x: pos.x + dxLocal * right.x, y: pos.y + dxLocal * right.y, angle: pos.angle };
}

const BOOST_MOVES: { label: string; m: Maneuver }[] = [
  { label: 'straight', m: { speed: 1, bearing: 'straight', difficulty: 'white' } },
  { label: 'bank-left', m: { speed: 1, bearing: 'bank-left', difficulty: 'white' } },
  { label: 'bank-right', m: { speed: 1, bearing: 'bank-right', difficulty: 'white' } },
];

/** Legal destinations for a boost (1-speed straight/bank) or barrel roll (a lateral
 *  slide one template + base wide), dropping any that would overlap another ship. */
export function repositionCandidates(
  state: GameState,
  ship: Ship,
  action: 'boost' | 'barrel-roll',
): RepositionCandidate[] {
  const out: RepositionCandidate[] = [];
  if (action === 'boost') {
    for (const { label, m } of BOOST_MOVES) {
      const to = applyManeuver(ship.pos, m, ship.base);
      if (!collides(state, ship, to)) out.push({ label, to });
    }
  } else {
    const dist = 40 + BASE_MM[ship.base];
    for (const [label, sign] of [
      ['left', -1],
      ['right', 1],
    ] as const) {
      const to = lateral(ship.pos, sign * dist);
      if (!collides(state, ship, to)) out.push({ label, to });
    }
  }
  return out;
}

/** SLAM destinations: any dial maneuver at the speed the ship executed this round,
 *  dropping placements that would overlap a ship. */
export function slamCandidates(state: GameState, ship: Ship): RepositionCandidate[] {
  const speed = ship.dial?.speed;
  if (speed === undefined) return [];
  const out: RepositionCandidate[] = [];
  for (const m of ship.dialOptions) {
    if (m.speed !== speed) continue;
    const to = applyManeuver(ship.pos, m, ship.base);
    if (!collides(state, ship, to)) out.push({ label: `${m.speed} ${m.bearing}`, to });
  }
  return out;
}
