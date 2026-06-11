/** A typed subset of the xwing-data2 schema — enough for R1 ships and pilots. */
export interface Stat {
  type: string;
  arc?: string;
  value: number;
}

export interface ActionData {
  type: string;
  difficulty: string;
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
