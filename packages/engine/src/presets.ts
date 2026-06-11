import type { GameConfig, ShipInit } from './events';
import type { ActionType, Maneuver, PlayerId, Position, ShipId } from './types';

const XWING_DIAL: Maneuver[] = [
  { speed: 1, bearing: 'bank-left', difficulty: 'blue' },
  { speed: 1, bearing: 'straight', difficulty: 'blue' },
  { speed: 1, bearing: 'bank-right', difficulty: 'blue' },
  { speed: 2, bearing: 'turn-left', difficulty: 'white' },
  { speed: 2, bearing: 'straight', difficulty: 'white' },
  { speed: 2, bearing: 'turn-right', difficulty: 'white' },
  { speed: 3, bearing: 'straight', difficulty: 'white' },
  { speed: 4, bearing: 'straight', difficulty: 'white' },
  { speed: 4, bearing: 'koiogran', difficulty: 'red' },
];

const TIE_DIAL: Maneuver[] = [
  { speed: 1, bearing: 'bank-left', difficulty: 'blue' },
  { speed: 1, bearing: 'straight', difficulty: 'blue' },
  { speed: 1, bearing: 'bank-right', difficulty: 'blue' },
  { speed: 2, bearing: 'turn-left', difficulty: 'white' },
  { speed: 2, bearing: 'bank-left', difficulty: 'white' },
  { speed: 2, bearing: 'straight', difficulty: 'white' },
  { speed: 2, bearing: 'bank-right', difficulty: 'white' },
  { speed: 2, bearing: 'turn-right', difficulty: 'white' },
  { speed: 3, bearing: 'straight', difficulty: 'white' },
  { speed: 4, bearing: 'straight', difficulty: 'white' },
  { speed: 5, bearing: 'straight', difficulty: 'white' },
  { speed: 3, bearing: 'koiogran', difficulty: 'red' },
];

const XWING_BAR: ActionType[] = ['focus', 'lock'];
const TIE_BAR: ActionType[] = ['focus', 'barrel-roll', 'evade'];

export function xwing(id: ShipId, ownerId: PlayerId, initiative: number, pos: Position): ShipInit {
  return {
    id,
    ownerId,
    shipType: 't65xwing',
    pilot: 'Blue Squadron Escort',
    initiative,
    base: 'small',
    primaryAttack: 3,
    agility: 2,
    hull: 4,
    shields: 2,
    pos,
    actionBar: XWING_BAR,
    dialOptions: XWING_DIAL,
  };
}

export function tieln(id: ShipId, ownerId: PlayerId, initiative: number, pos: Position): ShipInit {
  return {
    id,
    ownerId,
    shipType: 'tieln',
    pilot: 'Academy Pilot',
    initiative,
    base: 'small',
    primaryAttack: 2,
    agility: 3,
    hull: 3,
    shields: 0,
    pos,
    actionBar: TIE_BAR,
    dialOptions: TIE_DIAL,
  };
}

/** The iconic starter matchup: 2 X-wings (Rebel) vs 2 TIE/ln (Imperial). */
export function demoConfig(seed = 'demo', id = 'game-1'): GameConfig {
  const rebel = 'rebel';
  const imperial = 'imperial';
  return {
    id,
    seed,
    players: [
      { id: rebel, name: 'Rebel' },
      { id: imperial, name: 'Imperial' },
    ],
    ships: [
      xwing('x1', rebel, 4, { x: -100, y: -120, angle: 0 }),
      xwing('x2', rebel, 2, { x: 100, y: -120, angle: 0 }),
      tieln('t1', imperial, 3, { x: -100, y: 120, angle: 180 }),
      tieln('t2', imperial, 1, { x: 100, y: 120, angle: 180 }),
    ],
  };
}
