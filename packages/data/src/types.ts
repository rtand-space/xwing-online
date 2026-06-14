/** A typed subset of the xwing-data2 schema — enough for R1 ships and pilots. */
export interface Stat {
  type: string;
  arc?: string;
  value: number;
}

export interface ActionData {
  type: string;
  difficulty: string;
  /** A linked action that may be performed immediately after this one. */
  linked?: { type: string; difficulty: string };
}

export interface PilotData {
  name: string;
  xws: string;
  initiative: number;
  /** 0 = unlimited; otherwise the max copies of this pilot in a squad. */
  limited: number;
  /** Squad-point cost (fixed, never varies with upgrades). */
  cost: number;
  /** Per-pilot budget for this pilot's upgrades. */
  loadout: number;
  /** Upgrade slot bar (xws slot ids). */
  slots: string[];
  /** Force pool the pilot brings (value + per-round recovery), if a Force user. */
  force?: { value: number; recovers: number } | null;
}

export interface ShipData {
  name: string;
  xws: string;
  faction: string;
  size: string;
  stats: Stat[];
  actions: ActionData[];
  /** Maneuvers as xwing-data2 dial codes, e.g. "2BR" = speed 2, bank-left, red. */
  dial: string[];
  pilots: PilotData[];
}

export interface UpgradeData {
  xws: string;
  name: string;
  /** In the XWA points feed → buyable in normal list building. Cards absent from
   *  the feed (quick-build-only / scenario reprints) are excluded from slot options. */
  available: boolean;
  /** Primary slot this upgrade equips into. */
  slot: string;
  /** All slots it occupies (dual-slot upgrades occupy more than one). */
  slots: string[];
  /** Fixed loadout cost, or null when the cost varies (see variableCost). */
  cost: number | null;
  variableCost: { variable?: string; values?: Record<string, number> } | null;
  /** 0 = unlimited; otherwise the max copies in a squad. */
  limited: number;
  /** Charges this upgrade grants (and how many recover each round), if any. */
  charges: { value: number; recovers: number } | null;
  /** Secondary-weapon stats (torpedo/missile/cannon/turret), if this is a weapon. */
  weapon: {
    arc: string;
    value: number;
    minRange: number;
    maxRange: number;
    ordnance: boolean;
  } | null;
  /** Device (bomb/mine) name + type, if this is a device; effects live in engine code. */
  device: { name: string; type: string } | null;
  restrictions: unknown[];
}
