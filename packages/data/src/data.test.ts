import { createGame, type GameConfig } from '@xwing/engine';
import { describe, expect, it } from 'vitest';
import { getPilot, getShip } from './loaders';
import { parseManeuver } from './dial';
import { toShipInit } from './build';
import { parseXws, serializeXws, squadToShipInits, type XwsSquad } from './xws';

describe('card loaders', () => {
  it('returns typed stats for an xws id', () => {
    const xwing = getShip('t65xwing');
    expect(xwing.faction).toBe('Rebel Alliance');
    expect(xwing.stats.find((s) => s.type === 'attack')?.value).toBe(3);
    expect(getPilot('t65xwing', 'redsquadronveteran').initiative).toBe(4);
    expect(() => getShip('nope')).toThrow();
  });
});

describe('dial parsing', () => {
  it('decodes xwing-data2 dial codes', () => {
    expect(parseManeuver('4KR')).toEqual({ speed: 4, bearing: 'koiogran', difficulty: 'red' });
    expect(parseManeuver('1TW')).toEqual({ speed: 1, bearing: 'turn-left', difficulty: 'white' });
    expect(parseManeuver('2NB')).toEqual({ speed: 2, bearing: 'bank-right', difficulty: 'blue' });
    expect(parseManeuver('3ZX')).toBeNull(); // unsupported bearing/difficulty
  });
});

describe('card → engine ShipInit', () => {
  it('derives stats, action bar, and dial from card data', () => {
    const init = toShipInit(
      't65xwing',
      'bluesquadronescort',
      'rebel',
      { x: 0, y: 0, angle: 0 },
      'x1',
    );
    expect(init).toMatchObject({
      shipType: 't65xwing',
      base: 'small',
      initiative: 2,
      primaryAttack: 3,
      agility: 2,
      hull: 4,
      shields: 2,
      actionBar: ['focus', 'lock'],
    });
    expect(init.dialOptions).toContainEqual({ speed: 4, bearing: 'koiogran', difficulty: 'red' });
  });
});

const sample: XwsSquad = {
  faction: 'rebelalliance',
  name: 'Test Wing',
  points: 20,
  version: '2.5.0',
  pilots: [
    { id: 'bluesquadronescort', ship: 't65xwing', points: 4, upgrades: {} },
    { id: 'redsquadronveteran', ship: 't65xwing', points: 5, upgrades: {} },
  ],
};

describe('XWS format', () => {
  it('round-trips parse → serialize unchanged', () => {
    const json = JSON.stringify(sample);
    expect(JSON.parse(serializeXws(parseXws(json)))).toEqual(JSON.parse(json));
  });

  it('rejects malformed squads', () => {
    expect(() => parseXws('{}')).toThrow();
    expect(() => parseXws({ faction: 'x' })).toThrow();
  });

  it('builds a playable engine game from squads', () => {
    const positions = [
      { x: -100, y: -120, angle: 0 },
      { x: 100, y: -120, angle: 0 },
    ];
    const rebels = squadToShipInits(sample, 'rebel', positions);
    expect(rebels).toHaveLength(2);
    expect(rebels[0]!.initiative).toBe(2);

    const config: GameConfig = {
      id: 'g',
      seed: 's',
      players: [
        { id: 'rebel', name: 'Rebel' },
        { id: 'imperial', name: 'Imperial' },
      ],
      ships: rebels,
    };
    const game = createGame(config);
    expect(game.state.phase).toBe('planning');
    expect(game.state.ships).toHaveLength(2);
  });
});
