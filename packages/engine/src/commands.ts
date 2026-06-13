import type { ActionType, Maneuver, PlayerId, ShipId } from './types';

/** Player intent. Validated against `state.pending`; may be rejected. */
export type Command =
  | { type: 'SetDial'; playerId: PlayerId; shipId: ShipId; maneuver: Maneuver }
  | { type: 'ExecuteManeuver'; playerId: PlayerId; shipId: ShipId }
  | {
      type: 'PerformAction';
      playerId: PlayerId;
      shipId: ShipId;
      action: ActionType;
      targetId?: ShipId;
    }
  | { type: 'SkipAction'; playerId: PlayerId; shipId: ShipId }
  | { type: 'DeclareAttack'; playerId: PlayerId; shipId: ShipId; targetId: ShipId }
  | { type: 'PassAttack'; playerId: PlayerId; shipId: ShipId }
  | { type: 'UseAbility'; playerId: PlayerId; shipId: ShipId }
  | { type: 'SkipAbility'; playerId: PlayerId; shipId: ShipId }
  | { type: 'Decloak'; playerId: PlayerId; shipId: ShipId }
  | { type: 'SkipDecloak'; playerId: PlayerId; shipId: ShipId };
