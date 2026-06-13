import { describe, expect, it } from 'vitest';
import { allUpgrades, getPilot } from './loaders';
import { pilotChoices } from './presets';
import { SQUAD_POINT_CAP, squadPoints, upgradeOptions, validateSquad } from './squad';
import type { XwsSquad } from './xws';

const squad = (faction: string, pilots: { id: string; ship: string }[]): XwsSquad => ({
  faction,
  pilots,
});
const blue = { id: 'bluesquadronescort', ship: 't65xwing' };
const red = { id: 'redsquadronveteran', ship: 't65xwing' };
const academy = { id: 'academypilot', ship: 'tielnfighter' };

describe('squad validation', () => {
  it('accepts a legal 3-ship, single-faction squad under the cap', () => {
    const r = validateSquad(squad('rebelalliance', [blue, blue, red]));
    expect(r.valid).toBe(true);
    expect(r.points).toBeLessThanOrEqual(SQUAD_POINT_CAP);
  });

  it('rejects fewer than 3 ships', () => {
    const r = validateSquad(squad('rebelalliance', [blue, red]));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/at least 3/i);
  });

  it('rejects over the point cap', () => {
    // The 8 priciest distinct Rebel pilots blow well past the 50-point cap.
    const top = [...pilotChoices('Rebel Alliance')].sort((a, b) => b.cost - a.cost).slice(0, 8);
    const r = validateSquad(
      squad(
        'rebelalliance',
        top.map((c) => ({ id: c.pilotXws, ship: c.shipXws })),
      ),
    );
    expect(r.points).toBeGreaterThan(SQUAD_POINT_CAP);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/cap/i);
  });

  it('rejects mixed factions', () => {
    const r = validateSquad(squad('rebelalliance', [blue, academy, academy]));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/one faction/i);
  });

  it('squadPoints sums pilot costs', () => {
    const expected =
      getPilot('t65xwing', 'bluesquadronescort').cost +
      getPilot('t65xwing', 'redsquadronveteran').cost;
    expect(squadPoints(squad('rebelalliance', [blue, red]))).toBe(expected);
  });

  it('flags a pilot over its loadout budget', () => {
    const pilot = getPilot('tielnfighter', 'academypilot');
    const expensive = allUpgrades().find((u) => (u.cost ?? 0) > pilot.loadout);
    expect(expensive).toBeDefined();
    const s: XwsSquad = {
      faction: 'galacticempire',
      pilots: [
        { id: 'academypilot', ship: 'tielnfighter', upgrades: { talent: [expensive!.xws] } },
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

  it('upgradeOptions excludes quick-build-only / non-XWA upgrades', () => {
    // delta7b is a Configuration card available only via quick builds (not in XWA points)
    const opts = upgradeOptions('Configuration', 'delta7aethersprite');
    expect(opts.some((u) => u.xws === 'delta7b')).toBe(false);
    expect(opts.every((u) => u.available)).toBe(true);
  });
});
