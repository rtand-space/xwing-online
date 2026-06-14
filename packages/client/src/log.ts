import type { GameEvent } from '@xwing/engine';

/**
 * Human-readable log line for an event, or null to omit. Hides secret dial values.
 * `name` maps a ship id to its pilot name (falls back to the id when unknown).
 */
export function formatEvent(e: GameEvent, name: (id: string) => string = (id) => id): string | null {
  const n = name;
  switch (e.type) {
    case 'GameCreated':
      return 'Game started';
    case 'DialSet':
      return `${n(e.shipId)} set a dial`;
    case 'DialRevealed':
      return `${n(e.shipId)} reveals ${e.maneuver.speed} ${e.maneuver.bearing}`;
    case 'ShipMoved':
      return e.bumped ? `${n(e.shipId)} overlapped — backed off` : null;
    case 'Decloaked':
      return `${n(e.shipId)} decloaks`;
    case 'DecloakPassed':
      return null;
    case 'ObstacleHit':
      return `${n(e.shipId)} hits ${e.kind === 'asteroid' ? 'an asteroid' : 'a debris cloud'}`;
    case 'DeviceDropped':
      return `${n(e.shipId)} drops a ${e.kind}`;
    case 'DeviceDetonated':
      return `a ${e.shipId ? 'mine' : 'bomb'} detonates`;
    case 'DropSkipped':
      return null;
    case 'StressChanged':
      return e.delta > 0 ? `${n(e.shipId)} is stressed` : `${n(e.shipId)} cleared stress`;
    case 'ChargeChanged':
      return e.delta < 0 ? `${n(e.shipId)} spends a charge` : `${n(e.shipId)} recovers a charge`;
    case 'ForceChanged':
      return e.delta < 0 ? `${n(e.shipId)} spends Force` : `${n(e.shipId)} recovers Force`;
    case 'ActionPerformed':
      return `${n(e.shipId)}: ${e.action}${e.targetId ? ` ${n(e.targetId)}` : ''}`;
    case 'ActionSkipped':
      return `${n(e.shipId)}: no action`;
    case 'ArcRotated':
      return `${n(e.shipId)} rotates arc to ${e.to}`;
    case 'RepositionOffered':
      return null;
    case 'Repositioned':
      return `${n(e.shipId)} repositions`;
    case 'GrantOffered':
      return null;
    case 'GrantOfferResolved':
      return null;
    case 'ActionGranted':
      return `${n(e.shipId)} is granted a free action`;
    case 'GrantResolved':
      return null;
    case 'LinkOffered':
      return `${n(e.shipId)} may link ${e.action}`;
    case 'LinkResolved':
      return null;
    case 'TokenGained':
      return `${n(e.shipId)} gains ${e.kind}`;
    case 'TokenSpent':
      return `${n(e.shipId)} spends ${e.kind}`;
    case 'AttackDeclared':
      return `${n(e.shipId)}${e.bonus ? ' (bonus)' : ''} attacks ${n(e.targetId)}${e.weapon ? ` with ${e.weapon}` : ''} (range ${e.range})`;
    case 'BonusAttackOffered':
      return `${n(e.shipId)} may make a bonus attack`;
    case 'BonusAttackResolved':
      return null;
    case 'TargetOffered':
      return null;
    case 'TargetResolved':
      return null;
    case 'ConditionAssigned':
      return `${n(e.shipId)} gains ${e.condition}`;
    case 'ConditionRemoved':
      return `${n(e.shipId)} loses ${e.condition}`;
    case 'DiceRolled':
      return `  ${e.kind}: ${e.faces.join(', ')}`;
    case 'CombatBegan':
      return null;
    case 'CombatDiceSet':
      return null;
    case 'CombatAdvanced':
      return null;
    case 'CombatStep':
      return null;
    case 'CombatEnded':
      return null;
    case 'DamageDealt':
      return `${n(e.shipId)} takes ${e.amount} → ${e.shieldsAfter} shields, ${e.hullAfter} hull`;
    case 'DamageCardDealt':
      return `${n(e.shipId)} suffers a critical hit: ${e.card.name}`;
    case 'DamageCardRemoved':
      return `${n(e.shipId)} repairs a critical hit`;
    case 'ShipDestroyed':
      return `${n(e.shipId)} destroyed`;
    case 'AttackPassed':
      return `${n(e.shipId)} holds fire`;
    case 'AbilityOffered':
      return `${n(e.shipId)}: ${e.label}?`;
    case 'AbilityResolved':
      return null;
    case 'RoundEnded':
      return '— end of round —';
    case 'PhaseAdvanced':
      return `▸ ${e.to}`;
  }
}
