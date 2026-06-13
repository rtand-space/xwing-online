import {
  type Ability,
  addAttackDice,
  addDefenceDice,
  changeAttack,
  changeDefence,
  friendliesInRange,
  gainToken,
  inArc,
  inArcAt,
  inBullseye,
  inRange,
  chargesFrom,
  offerActionGrant,
  registerAbility,
  rerollAttack,
  rerollDefence,
  type Ship,
  spendCharge,
} from '@xwing/engine';

const SIZE_RANK: Record<Ship['base'], number> = { small: 0, medium: 1, large: 2 };
/** True if `a` is behind `b` (in the rear half of b's base). */
const behind = (a: Ship, b: Ship): boolean => inArcAt(b, a, 180, 90);

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

  // Predator (Talent) — may reroll a die against a target in your bullseye arc.
  predator: {
    note: 'While attacking a target in your bullseye arc, may reroll 1 blank attack die.',
    optionalAttack: {
      onModifyAttack: {
        label: 'Predator: reroll a blank',
        reroll: true,
        available: (ctx) => inBullseye(ctx.attacker, ctx.target) && ctx.attack.includes('blank'),
        apply: (ctx) => rerollAttack(ctx, 'blank', 1),
      },
    },
  },

  // Marksmanship (Talent) — may upgrade a hit to a crit against a bullseye target.
  marksmanship: {
    note: 'While attacking a target in your bullseye arc, may change 1 hit to a crit.',
    optionalAttack: {
      onModifyAttack: {
        label: 'Marksmanship: hit → crit',
        available: (ctx) => inBullseye(ctx.attacker, ctx.target) && ctx.attack.includes('hit'),
        apply: (ctx) => changeAttack(ctx, 'hit', 'crit', 1),
      },
    },
  },

  // Fanatical (Talent) — while unshielded, may turn a focus into a hit.
  fanatical: {
    note: 'While attacking with no shields, may change 1 focus result to a hit.',
    optionalAttack: {
      onModifyAttack: {
        label: 'Fanatical: focus → hit',
        available: (ctx) => ctx.attacker.shields === 0 && ctx.attack.includes('focus'),
        apply: (ctx) => changeAttack(ctx, 'focus', 'hit', 1),
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

  // Howlrunner (TIE/ln) — reroll aura: a friendly attacker at range 0–1 rerolls a die.
  howlrunner: {
    note: 'While a friendly ship at range 0–1 attacks, it may reroll 1 attack die.',
    attack: {
      onModifyAttack: (ctx, self) => {
        if (
          ctx.attacker.id !== self.id &&
          ctx.attacker.ownerId === self.ownerId &&
          inRange(self, ctx.attacker, 1)
        ) {
          rerollAttack(ctx, 'blank', 1);
        }
      },
    },
  },

  // Gideon Hask — presses the advantage against a wounded target.
  gideonhask: {
    note: 'While attacking a damaged defender, roll 1 extra attack die.',
    attack: {
      onRollAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && ctx.target.hull < ctx.target.maxHull) addAttackDice(ctx, 1);
      },
    },
  },

  // Graz — deadly from the blind spot, on offence or defence.
  graz: {
    note: 'Attacking from behind the defender, or defending from behind the attacker, roll 1 extra die.',
    attack: {
      onRollAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && behind(ctx.attacker, ctx.target)) addAttackDice(ctx, 1);
      },
      onRollDefence: (ctx, self) => {
        if (ctx.target.id === self.id && behind(ctx.target, ctx.attacker)) addDefenceDice(ctx, 1);
      },
    },
  },

  // Ahhav — punches up against bigger ships.
  ahhav: {
    note: 'Attacking or defending against a larger-based ship, roll 1 extra die.',
    attack: {
      onRollAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && SIZE_RANK[ctx.target.base] > SIZE_RANK[self.base])
          addAttackDice(ctx, 1);
      },
      onRollDefence: (ctx, self) => {
        if (ctx.target.id === self.id && SIZE_RANK[ctx.attacker.base] > SIZE_RANK[self.base])
          addDefenceDice(ctx, 1);
      },
    },
  },

  // Lieutenant Blount — concentrated fire when a wingmate is on the target.
  lieutenantblount: {
    note: 'While attacking, if another friendly ship is at range 0–1 of the defender, roll 1 extra attack die.',
    attack: {
      onRollAttack: (ctx, self) => {
        if (ctx.attacker.id !== self.id) return;
        const near = ctx.state.ships.some(
          (s) => s.id !== self.id && s.ownerId === self.ownerId && s.hull > 0 && inRange(s, ctx.target, 1),
        );
        if (near) addAttackDice(ctx, 1);
      },
    },
  },

  // Laetin A'shera — a clean break earns an evade.
  laetinashera: {
    note: 'After an attack you make or defend against deals no damage, gain an evade token.',
    attack: {
      onAfterAttack: (ctx, self) => {
        const involved = ctx.attacker.id === self.id || ctx.target.id === self.id;
        if (involved && ctx.result.hits + ctx.result.crits === 0) ctx.events.push(gainToken(self, 'evade'));
      },
    },
  },

  // "Night Beast" — a steady maneuver lets it line up a focus.
  nightbeast: {
    note: 'After fully executing a blue maneuver, may gain a focus token.',
    optional: {
      afterMove: {
        label: 'Night Beast: gain a focus token?',
        available: ({ self }) => self.dial?.difficulty === 'blue',
        resolve: ({ self }) => [gainToken(self, 'focus')],
      },
    },
  },

  // Ahsoka Tano — channels the Force to hand a nearby ally a free action.
  ahsokatano: {
    note: 'After fully executing a maneuver, may spend 1 Force to grant a friendly ship at range 0–1 an action.',
    optional: {
      afterMove: {
        label: 'Ahsoka Tano: spend 1 Force for a friendly ship to act?',
        available: ({ state, self }) =>
          (self.force ?? 0) > 0 && friendliesInRange(state, self, 1).length > 0,
        resolve: ({ state, self }) => [
          offerActionGrant(self, friendliesInRange(state, self, 1).map((s) => s.id), true),
        ],
      },
    },
  },

  // Airen Cracken — calls a wingmate into action right after firing.
  airencracken: {
    note: 'After performing an attack, may let a friendly ship at range 1 perform an action.',
    attack: {
      onAfterAttack: (ctx, self) => {
        if (ctx.attacker.id !== self.id) return;
        const cands = friendliesInRange(ctx.state, self, 1).map((s) => s.id);
        if (cands.length) ctx.events.push(offerActionGrant(self, cands, false));
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
