import { type Ability, addAttackDice, inArc, registerAbility } from '@xwing/engine';

/**
 * Concrete card abilities, keyed by xws. Behaviour only — never the card's
 * printed text (short paraphrases in `note`). This set grows over R3; the
 * builder marks which cards are simulated via `implementedAbility`.
 */
const ABILITIES: Record<string, Ability> = {
  // Wedge Antilles (T-65 X-wing) — stable across editions.
  wedgeantilles: {
    note: 'While attacking, the defender rolls 1 fewer defence die.',
    attack: {
      onRollDefence: (ctx, self) => {
        if (ctx.attacker.id === self.id && ctx.defence.length > 0) {
          ctx.defence = ctx.defence.slice(0, -1);
        }
      },
    },
  },

  // Backstabber (TIE/ln) — +1 attack die when attacking from outside the defender's arc.
  'backstabber-battleofyavin': {
    note: 'While attacking from outside the defender’s firing arc, roll 1 extra attack die.',
    attack: {
      onRollAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && !inArc(ctx.target, ctx.attacker)) addAttackDice(ctx, 1);
      },
    },
  },

  // Outmaneuver (Talent) — defender rolls 1 fewer die when attacked from outside its arc.
  outmaneuver: {
    note: 'While attacking from outside the defender’s firing arc, the defender rolls 1 fewer die.',
    attack: {
      onRollDefence: (ctx, self) => {
        if (
          ctx.attacker.id === self.id &&
          !inArc(ctx.target, ctx.attacker) &&
          ctx.defence.length > 0
        ) {
          ctx.defence = ctx.defence.slice(0, -1);
        }
      },
    },
  },
};

let installed = false;
/** Register all implemented abilities into the engine registry (idempotent). */
export function installAbilities(): void {
  if (installed) return;
  for (const [xws, ability] of Object.entries(ABILITIES)) registerAbility(xws, ability);
  installed = true;
}

/** Does the engine simulate this card's ability yet? (for builder honesty) */
export const implementedAbility = (xws: string): boolean => xws in ABILITIES;
