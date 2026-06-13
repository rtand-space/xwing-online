import {
  type Ability,
  addAttackDice,
  addDefenceDice,
  addStress,
  changeAttack,
  changeDefence,
  friendliesInRange,
  gainToken,
  spendForce,
  inArc,
  inArcAt,
  inBullseye,
  inRange,
  chargesFrom,
  offerActionGrant,
  offerBonusAttack,
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

  // Predator (Talent) — reroll a die against a target in your bullseye arc.
  // Cost-free (no token/charge), so it resolves automatically.
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

  // Marksmanship (Talent) — upgrade a hit to a crit against a bullseye target (cost-free).
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

  // Fanatical (Talent) — while unshielded, turn a focus into a hit (cost-free).
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

  // Crack Shot (Talent) — may spend its charge to cancel an evade against a bullseye
  // target. Charge is a cost, so it's an optional offer (during the attacker's
  // after-defence step).
  crackshot: {
    note: 'While attacking a target in your bullseye arc, may spend a charge to cancel 1 evade.',
    optionalAttack: {
      onModifyDefence: {
        label: 'Crack Shot: cancel an evade (charge)',
        available: (ctx, self) =>
          chargesFrom(self, 'crackshot') > 0 &&
          inBullseye(ctx.attacker, ctx.target) &&
          ctx.defence.includes('evade'),
        apply: (ctx, self) => {
          changeDefence(ctx, 'evade', 'blank', 1);
          ctx.events.push(spendCharge(self, 'crackshot'));
        },
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

  // --- First Order ---

  // "Null" — flies its best while pristine. Dynamic initiative.
  null: {
    note: 'While undamaged, your initiative is 7.',
    initiative: (self) => (self.hull >= self.maxHull ? 7 : undefined),
  },

  // "Rush" — fights harder once hurt. Dynamic initiative.
  rush: {
    note: 'While damaged, your initiative is 6.',
    initiative: (self) => (self.hull < self.maxHull ? 6 : undefined),
  },

  // "Avenger" — spurred on by a wingmate's loss. Reactive (onDestroyed, fired only
  // for friendlies of the lost ship), cost-free → grants a free action.
  avenger: {
    note: 'After another friendly ship is destroyed, may perform an action.',
    optional: {
      onDestroyed: {
        label: 'Avenger: perform an action',
        available: () => true,
        resolve: ({ self }) => [{ type: 'ActionGranted', shipId: self.id }],
      },
    },
  },

  // "Midnight" — a perfect lock jams the enemy's tricks. Cost-free dice lockdown.
  midnight: {
    note: 'While attacking or defending, if you have a lock on the enemy ship, its dice cannot be modified.',
    lockdown: (ctx, self) => {
      const enemyId = self.id === ctx.attacker.id ? ctx.target.id : ctx.attacker.id;
      return self.tokens.some((t) => t.kind === 'lock' && t.targetId === enemyId);
    },
  },

  // "Backdraft" — turret covers his tail. Cost-free, automatic.
  backdraft: {
    note: 'While attacking, if the defender is in your rear arc, roll 1 extra attack die.',
    attack: {
      onRollAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && inArcAt(ctx.attacker, ctx.target, 180, 45))
          addAttackDice(ctx, 1);
      },
    },
  },

  // "Blackout" — hunts through the debris. Cost-free, automatic.
  blackout: {
    note: 'While attacking through an obstacle, the defender rolls 2 fewer defence dice.',
    attack: {
      onRollDefence: (ctx, self) => {
        if (ctx.attacker.id === self.id && ctx.obstructed) ctx.defence = ctx.defence.slice(0, -2);
      },
    },
  },

  // "Longshot" — reaches out. Cost-free, automatic.
  longshot: {
    note: 'While attacking at range 3, roll 1 extra attack die.',
    attack: {
      onRollAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && ctx.range === 3) addAttackDice(ctx, 1);
      },
    },
  },

  // Dengar — returns fire on anyone foolish enough to shoot him. Reactive
  // (afterDefend), costs a charge, and targets the attacker via the attacker context.
  dengar: {
    note: 'After you defend, if the attacker is in your front arc, may spend a charge for a bonus attack against it.',
    optional: {
      afterDefend: {
        label: 'Dengar: spend a charge to return fire',
        available: ({ state, self, attackerId }) => {
          if (!attackerId || self.charges <= 0) return false;
          const attacker = state.ships.find((s) => s.id === attackerId);
          return !!attacker && attacker.hull > 0 && inArc(self, attacker);
        },
        resolve: ({ self, attackerId }) => [
          spendCharge(self),
          offerBonusAttack(self, attackerId ? [attackerId] : undefined),
        ],
      },
    },
  },

  // "Quickdraw" — fires back the instant the shields drop. Reactive (onShieldLost);
  // costs a charge, so it's an optional offer that grants a bonus attack.
  quickdraw: {
    note: 'After you lose a shield, may spend a charge to perform a bonus primary attack.',
    optional: {
      onShieldLost: {
        label: 'Quickdraw: spend a charge for a bonus attack',
        available: ({ self }) => self.charges > 0,
        resolve: ({ self }) => [spendCharge(self), offerBonusAttack(self)],
      },
    },
  },

  // Lieutenant Tavson — turns a hit into momentum. Reactive (onDamaged); costs a
  // charge, so it's an optional offer that grants a free action (reuses ActionGranted).
  lieutenanttavson: {
    note: 'After you suffer damage, may spend a charge to perform an action.',
    optional: {
      onDamaged: {
        label: 'Tavson: spend a charge to take an action',
        available: ({ self }) => self.charges > 0,
        resolve: ({ self }) => [spendCharge(self), { type: 'ActionGranted', shipId: self.id }],
      },
    },
  },

  // "DT-798" — strains the frame for one more shot. Costs strain → optional.
  dt798: {
    note: 'While attacking, if not strained, may gain a strain token to roll 1 extra attack die.',
    optionalAttack: {
      onModifyAttack: {
        label: 'DT-798: take strain for an extra die',
        available: (ctx, self) =>
          ctx.attacker.id === self.id && !self.tokens.some((t) => t.kind === 'strain'),
        apply: (ctx, self) => {
          addAttackDice(ctx, 1);
          ctx.events.push(gainToken(self, 'strain'));
        },
      },
    },
  },

  // "Static" — dumps everything into a perfect burst. Costs a lock + focus → optional.
  static: {
    note: 'While attacking, may spend your lock on the defender and a focus token to change all results to crits.',
    optionalAttack: {
      onModifyAttack: {
        label: 'Static: lock + focus → all crits',
        available: (ctx, self) =>
          self.tokens.some((t) => t.kind === 'lock' && t.targetId === ctx.target.id) &&
          self.tokens.some((t) => t.kind === 'focus') &&
          ctx.attack.some((f) => f !== 'crit'),
        apply: (ctx, self) => {
          ctx.attack = ctx.attack.map(() => 'crit');
          ctx.events.push({ type: 'TokenSpent', shipId: self.id, kind: 'lock', targetId: ctx.target.id });
          ctx.events.push({ type: 'TokenSpent', shipId: self.id, kind: 'focus' });
        },
      },
    },
  },

  // Ric Olié — speed gives the edge. Cost-free, so automatic.
  ricolie: {
    note: 'Attacking or defending, if your revealed maneuver is faster than the enemy ship’s, roll 1 extra die.',
    attack: {
      onRollAttack: (ctx, self) => {
        if (ctx.attacker.id === self.id && (self.dial?.speed ?? 0) > (ctx.target.dial?.speed ?? 0))
          addAttackDice(ctx, 1);
      },
      onRollDefence: (ctx, self) => {
        if (ctx.target.id === self.id && (self.dial?.speed ?? 0) > (ctx.attacker.dial?.speed ?? 0))
          addDefenceDice(ctx, 1);
      },
    },
  },

  // "Scorch" — push the engines for an extra shot. Costs a stress, so it's optional.
  scorch: {
    note: 'While attacking, if unstressed, may gain a stress token to roll 1 extra attack die.',
    optionalAttack: {
      onModifyAttack: {
        label: 'Scorch: take stress for an extra die',
        available: (ctx, self) =>
          ctx.attacker.id === self.id && !self.tokens.some((t) => t.kind === 'stress'),
        apply: (ctx, self) => {
          addAttackDice(ctx, 1);
          ctx.events.push(addStress(self));
        },
      },
    },
  },

  // Darth Vader (TIE Advanced) — spends the Force to find the mark. Cost → optional.
  'darthvader-battleofyavin': {
    note: 'While attacking, may spend 1 Force to change a blank result to a hit.',
    optionalAttack: {
      onModifyAttack: {
        label: 'Vader: Force → blank to hit',
        available: (ctx, self) => (self.force ?? 0) > 0 && ctx.attack.includes('blank'),
        apply: (ctx, self) => {
          changeAttack(ctx, 'blank', 'hit', 1);
          ctx.events.push(spendForce(self));
        },
      },
    },
  },

  // Ezra Bridger — channels stress through the Force. Costs Force, so it's optional.
  ezrabridger: {
    note: 'While stressed, may spend 1 Force to change up to 2 of your focus results (hits attacking, evades defending).',
    optionalAttack: {
      onModifyAttack: {
        label: 'Ezra: Force → up to 2 focus to hits',
        available: (ctx, self) =>
          ctx.attacker.id === self.id &&
          (self.force ?? 0) > 0 &&
          self.tokens.some((t) => t.kind === 'stress') &&
          ctx.attack.includes('focus'),
        apply: (ctx, self) => {
          changeAttack(ctx, 'focus', 'hit', 2);
          ctx.events.push(spendForce(self));
        },
      },
      onModifyDefence: {
        label: 'Ezra: Force → up to 2 focus to evades',
        available: (ctx, self) =>
          ctx.target.id === self.id &&
          (self.force ?? 0) > 0 &&
          self.tokens.some((t) => t.kind === 'stress') &&
          ctx.defence.includes('focus'),
        apply: (ctx, self) => {
          changeDefence(ctx, 'focus', 'evade', 2);
          ctx.events.push(spendForce(self));
        },
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
