import {
  type Ability,
  addAttackDice,
  changeAttack,
  changeDefence,
  inArc,
  inBullseye,
  chargesFrom,
  registerAbility,
  rerollAttack,
  rerollDefence,
  spendCharge,
} from '@xwing/engine';

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

  // Juke (Talent) — while you have an evade token, turn one defender evade into a focus.
  juke: {
    note: 'While attacking, if you are evading, change 1 defender evade result to a focus.',
    attack: {
      onModifyDefence: (ctx, self) => {
        if (ctx.attacker.id === self.id && ctx.attacker.tokens.some((t) => t.kind === 'evade')) {
          changeDefence(ctx, 'evade', 'focus', 1);
        }
      },
    },
  },

  // Fearless (Talent) — point-blank inside the defender's front arc, turn a result into a hit.
  fearless: {
    note: 'While attacking at range 1 from inside the defender’s front arc, change 1 result to a hit.',
    attack: {
      onModifyAttack: (ctx, self) => {
        if (ctx.attacker.id !== self.id || ctx.range !== 1 || !inArc(ctx.target, ctx.attacker)) {
          return;
        }
        if (ctx.attack.includes('blank')) changeAttack(ctx, 'blank', 'hit', 1);
        else changeAttack(ctx, 'focus', 'hit', 1);
      },
    },
  },

  // Predator (Talent) — reroll a die against a target in your bullseye arc.
  predator: {
    note: 'While attacking a target in your bullseye arc, reroll 1 blank attack die.',
    attack: {
      onModifyAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && inBullseye(ctx.attacker, ctx.target)) {
          rerollAttack(ctx, 'blank', 1);
        }
      },
    },
  },

  // Marksmanship (Talent) — upgrade a hit to a crit against a bullseye target.
  marksmanship: {
    note: 'While attacking a target in your bullseye arc, change 1 hit to a crit.',
    attack: {
      onModifyAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && inBullseye(ctx.attacker, ctx.target)) {
          changeAttack(ctx, 'hit', 'crit', 1);
        }
      },
    },
  },

  // Fanatical (Talent) — while unshielded, turn a focus into a hit.
  fanatical: {
    note: 'While attacking with no shields, change 1 focus result to a hit.',
    attack: {
      onModifyAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && ctx.attacker.shields === 0) {
          changeAttack(ctx, 'focus', 'hit', 1);
        }
      },
    },
  },

  // Trick Shot (Talent) — bonus die when your shot is obstructed by an obstacle.
  trickshot: {
    note: 'While attacking through an obstacle, roll 1 extra attack die.',
    attack: {
      onRollAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && ctx.obstructed) addAttackDice(ctx, 1);
      },
    },
  },

  // Crack Shot (Talent) — spend its charge to cancel an evade against a bullseye target.
  crackshot: {
    note: 'While attacking a bullseye target, spend a charge to cancel 1 evade result.',
    attack: {
      onModifyDefence: (ctx, self) => {
        if (
          ctx.attacker.id === self.id &&
          chargesFrom(ctx.attacker, 'crackshot') > 0 &&
          inBullseye(ctx.attacker, ctx.target) &&
          ctx.defence.includes('evade')
        ) {
          changeDefence(ctx, 'evade', 'blank', 1);
          ctx.events.push(spendCharge(self, 'crackshot'));
        }
      },
    },
  },

  // Heroic (Talent) — reroll an all-blank roll of 2+ dice, attacking or defending.
  heroic: {
    note: 'If all your dice are blanks (2+), reroll them — attacking or defending.',
    attack: {
      onModifyAttack: (ctx, self) => {
        if (
          ctx.attacker.id === self.id &&
          ctx.attack.length >= 2 &&
          ctx.attack.every((f) => f === 'blank')
        ) {
          rerollAttack(ctx, 'blank');
        }
      },
      onModifyDefence: (ctx, self) => {
        if (
          ctx.target.id === self.id &&
          ctx.defence.length >= 2 &&
          ctx.defence.every((f) => f === 'blank')
        ) {
          rerollDefence(ctx, 'blank');
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

/** Our short paraphrase of a simulated ability, for UI hints. */
export const abilityNote = (xws: string): string | undefined => ABILITIES[xws]?.note;
