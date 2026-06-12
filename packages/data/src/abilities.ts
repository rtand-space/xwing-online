import { type Ability, registerAbility } from '@xwing/engine';

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
