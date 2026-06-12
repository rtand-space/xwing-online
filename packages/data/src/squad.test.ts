import { describe, expect, it } from 'vitest';
import { squadPoints, upgradeOptions, validateSquad } from './squad';
import type { XwsSquad } from './xws';

const squad = (faction: string, pilots: { id: string; ship: string }[]): XwsSquad => ({
  faction,
  pilots,
});
const blue = { id: 'bluesquadronescort', ship: 't65xwing' }; // cost 5
const red = { id: 'redsquadronveteran', ship: 't65xwing' }; // cost 5
const academy = { id: 'academypilot', ship: 'tielnfighter' }; // cost 2, imperial

describe('squad validation', () => {
  it('accepts a legal 3-ship, single-faction squad under the cap', () => {
    const r = validateSquad(squad('rebelalliance', [blue, blue, red]));
    expect(r.valid).toBe(true);
    expect(r.points).toBe(15); // 5 + 5 + 5
  });

  it('rejects fewer than 3 ships', () => {
    const r = validateSquad(squad('rebelalliance', [blue, red]));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/at least 3/i);
  });

  it('rejects over the 20-point cap', () => {
    const r = validateSquad(squad('rebelalliance', [red, red, red, red, red])); // 25
    expect(r.valid).toBe(false);
    expect(r.points).toBe(25);
    expect(r.errors.join(' ')).toMatch(/cap/i);
  });

  it('rejects mixed factions', () => {
    const r = validateSquad(squad('rebelalliance', [blue, academy, academy]));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/one faction/i);
  });

  it('squadPoints sums pilot costs', () => {
    expect(squadPoints(squad('rebelalliance', [blue, red]))).toBe(10);
  });

  it('flags a pilot over its loadout budget', () => {
    const s: XwsSquad = {
      faction: 'galacticempire',
      pilots: [
        { id: 'academypilot', ship: 'tielnfighter', upgrades: { talent: ['composure'] } }, // loadout 0
        { id: 'academypilot', ship: 'tielnfighter' },
        { id: 'obsidiansquadronpilot', ship: 'tielnfighter' },
      ],
    };
    const r = validateSquad(s);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/loadout/i);
  });

  it('upgradeOptions returns slot-legal, single-slot upgrades', () => {
    const opts = upgradeOptions('Talent', 't65xwing');
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((u) => u.slots.length === 1)).toBe(true);
  });
});
