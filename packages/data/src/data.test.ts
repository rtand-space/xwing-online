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
    expect(getPilot('t65xwing', 'redsquadronveteran').initiative).toBe(3);
    expect(() => getShip('nope')).toThrow();
  });
});

describe('dial parsing', () => {
  it('decodes xwing-data2 dial codes', () => {
    expect(parseManeuver('4KR')).toEqual({ speed: 4, bearing: 'koiogran', difficulty: 'red' });
    expect(parseManeuver('1TW')).toEqual({ speed: 1, bearing: 'turn-left', difficulty: 'white' });
    expect(parseManeuver('2NB')).toEqual({ speed: 2, bearing: 'bank-right', difficulty: 'blue' });
    expect(parseManeuver('3ZX')).toBeNull(); // malformed bearing/difficulty
  });

  it('decodes the full advanced vocabulary (no dropped maneuvers)', () => {
    expect(parseManeuver('3LR')).toEqual({
      speed: 3,
      bearing: 'segnors-loop-left',
      difficulty: 'red',
    }); // StarViper
    expect(parseManeuver('3PR')).toEqual({
      speed: 3,
      bearing: 'segnors-loop-right',
      difficulty: 'red',
    });
    expect(parseManeuver('2ER')).toEqual({
      speed: 2,
      bearing: 'tallon-roll-left',
      difficulty: 'red',
    }); // Fang
    expect(parseManeuver('2RR')).toEqual({
      speed: 2,
      bearing: 'tallon-roll-right',
      difficulty: 'red',
    });
    expect(parseManeuver('1AR')).toEqual({
      speed: 1,
      bearing: 'reverse-bank-left',
      difficulty: 'red',
    });
    expect(parseManeuver('1SR')).toEqual({
      speed: 1,
      bearing: 'reverse-straight',
      difficulty: 'red',
    });
    expect(parseManeuver('1DR')).toEqual({
      speed: 1,
      bearing: 'reverse-bank-right',
      difficulty: 'red',
    });
    expect(parseManeuver('0OR')).toEqual({ speed: 0, bearing: 'stationary', difficulty: 'red' });
    expect(parseManeuver('2EP')).toEqual({
      speed: 2,
      bearing: 'tallon-roll-left',
      difficulty: 'purple',
    }); // Eta-2
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
      actionBar: ['focus', 'lock', 'barrel-roll'],
    });
    expect(init.dialOptions).toContainEqual({ speed: 4, bearing: 'koiogran', difficulty: 'red' });
  });

  it('sums charges granted by equipped upgrades', () => {
    const init = toShipInit(
      't65xwing',
      'bluesquadronescort',
      'rebel',
      { x: 0, y: 0, angle: 0 },
      'x1',
      ['crackshot'],
    );
    expect(init.upgradeCharges?.crackshot).toEqual({ charges: 1, max: 1, recovers: 0 });
  });

  it('seeds the Force pool from a Force-using pilot', () => {
    const luke = toShipInit('t65xwing', 'lukeskywalker', 'rebel', { x: 0, y: 0, angle: 0 }, 'l1');
    expect(luke.maxForce).toBe(2);
    expect(luke.force).toBe(2);
    expect(luke.forceRecovers).toBe(1);
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

describe('full xwing-data2 snapshot', () => {
  it('loads the full roster across all factions', async () => {
    const { allShips, allUpgrades, DATA_VERSION } = await import('./index');
    const ships = allShips();
    expect(ships.length).toBeGreaterThan(80);
    const xws = ships.map((s) => s.xws);
    for (const id of ['t65xwing', 'tielnfighter', 'rz1awing', 'tieininterceptor']) {
      expect(xws).toContain(id);
    }
    expect(new Set(ships.map((s) => s.faction)).size).toBeGreaterThanOrEqual(7);
    expect(allUpgrades().length).toBeGreaterThan(400);
    expect(DATA_VERSION).toMatch(/^XWA /);
  });

  it('every pilot is well-formed (initiative, cost, loadout, slots)', async () => {
    const { allShips } = await import('./index');
    const pilots = allShips().flatMap((s) => s.pilots);
    expect(pilots.length).toBeGreaterThan(690);
    for (const p of pilots) {
      expect(typeof p.initiative, p.xws).toBe('number');
      expect(typeof p.cost, p.xws).toBe('number');
      expect(typeof p.loadout, p.xws).toBe('number');
      expect(Array.isArray(p.slots), p.xws).toBe(true);
    }
  });

  it('every dial code in the snapshot parses (nothing dropped)', async () => {
    const { allShips, parseManeuver } = await import('./index');
    for (const ship of allShips()) {
      for (const code of ship.dial) {
        expect(parseManeuver(code), `${ship.xws} ${code}`).not.toBeNull();
      }
    }
  });

  it('builds an A-wing from snapshot data', async () => {
    const { toShipInit } = await import('./index');
    const awing = toShipInit(
      'rz1awing',
      'greensquadronpilot',
      'rebel',
      { x: 0, y: 0, angle: 0 },
      'a1',
    );
    expect(awing.actionBar).toContain('boost');
    expect(awing.primaryAttack).toBe(2);
    expect(awing.dialOptions.length).toBeGreaterThan(10);
  });
});
