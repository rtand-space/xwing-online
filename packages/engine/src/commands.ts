import type { ActionType, Maneuver, PlayerId, ShipId, SpendKind, TurretFacing } from './types';

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
      /** For rotate-arc: which orientation to point the turret to. */
      facing?: TurretFacing;
    }
  | { type: 'SkipAction'; playerId: PlayerId; shipId: ShipId }
  | {
      type: 'DropDevice';
      playerId: PlayerId;
      shipId: ShipId;
      xws: string;
      /** Index into the offered placements for this device. */
      choice: number;
    }
  | { type: 'SkipDrop'; playerId: PlayerId; shipId: ShipId }
  | {
      type: 'DeclareAttack';
      playerId: PlayerId;
      shipId: ShipId;
      targetId: ShipId;
      /** Equipped weapon xws to fire; absent = primary attack. */
      weapon?: string;
    }
  | { type: 'PassAttack'; playerId: PlayerId; shipId: ShipId }
  | { type: 'UseAbility'; playerId: PlayerId; shipId: ShipId }
  | { type: 'SkipAbility'; playerId: PlayerId; shipId: ShipId }
  | { type: 'Decloak'; playerId: PlayerId; shipId: ShipId }
  | { type: 'SkipDecloak'; playerId: PlayerId; shipId: ShipId }
  | { type: 'Reposition'; playerId: PlayerId; shipId: ShipId; choice: number }
  | { type: 'GrantAction'; playerId: PlayerId; shipId: ShipId; targetId: ShipId }
  | { type: 'DeclineGrant'; playerId: PlayerId; shipId: ShipId }
  | { type: 'Modify'; playerId: PlayerId; shipId: ShipId; spend: SpendKind }
  | { type: 'UseModifyAbility'; playerId: PlayerId; shipId: ShipId; xws: string }
  | { type: 'ModifyDone'; playerId: PlayerId; shipId: ShipId }
  | { type: 'SelectTarget'; playerId: PlayerId; shipId: ShipId; targetId: ShipId }
  | { type: 'SkipTarget'; playerId: PlayerId; shipId: ShipId };
