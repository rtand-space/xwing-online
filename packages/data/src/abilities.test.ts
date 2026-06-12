import { type AttackContext, getAbility, type Ship } from '@xwing/engine';
import { describe, expect, it } from 'vitest';
import { implementedAbility, installAbilities } from './abilities';

installAbilities();

describe('card abilities', () => {
  it('flags which cards are simulated', () => {
    expect(implementedAbility('wedgeantilles')).toBe(true);
    expect(implementedAbility('academypilot')).toBe(false);
  });

  it('Wedge Antilles drops a defence die when he is the attacker', () => {
    const ability = getAbility('wedgeantilles');
    expect(ability).toBeDefined();
    const self = { id: 'a' } as unknown as Ship;

    const mine = {
      attacker: { id: 'a' },
      defence: ['evade', 'blank', 'focus'],
    } as unknown as AttackContext;
    ability!.attack!.onRollDefence!(mine, self);
    expect(mine.defence).toHaveLength(2);

    // someone else's attack — untouched
    const other = {
      attacker: { id: 'x' },
      defence: ['evade', 'blank'],
    } as unknown as AttackContext;
    ability!.attack!.onRollDefence!(other, self);
    expect(other.defence).toHaveLength(2);
  });
});
