import type { GameEvent } from '@xwing/engine';

/** Human-readable log line for an event, or null to omit. Hides secret dial values. */
export function formatEvent(e: GameEvent): string | null {
  switch (e.type) {
    case 'GameCreated':
      return 'Game started';
    case 'DialSet':
      return `${e.shipId} set a dial`;
    case 'DialRevealed':
      return `${e.shipId} reveals ${e.maneuver.speed} ${e.maneuver.bearing}`;
    case 'ShipMoved':
      return e.bumped ? `${e.shipId} overlapped — backed off` : null;
    case 'StressChanged':
      return e.delta > 0 ? `${e.shipId} is stressed` : `${e.shipId} cleared stress`;
    case 'ActionPerformed':
      return `${e.shipId}: ${e.action}${e.targetId ? ` ${e.targetId}` : ''}`;
    case 'ActionSkipped':
      return `${e.shipId}: no action`;
    case 'TokenGained':
      return `${e.shipId} gains ${e.kind}`;
    case 'TokenSpent':
      return `${e.shipId} spends ${e.kind}`;
    case 'AttackDeclared':
      return `${e.shipId} attacks ${e.targetId} (range ${e.range})`;
    case 'DiceRolled':
      return `  ${e.kind}: ${e.faces.join(', ')}`;
    case 'DamageDealt':
      return `${e.shipId} takes ${e.amount} → ${e.shieldsAfter} shields, ${e.hullAfter} hull`;
    case 'ShipDestroyed':
      return `${e.shipId} destroyed`;
    case 'AttackPassed':
      return `${e.shipId} holds fire`;
    case 'RoundEnded':
      return '— end of round —';
    case 'PhaseAdvanced':
      return `▸ ${e.to}`;
  }
}
