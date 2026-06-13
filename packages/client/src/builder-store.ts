import type { FactionId, PilotChoice } from '@xwing/data';
import { create } from 'zustand';

/** A chosen pilot plus its equipped upgrades, aligned index-for-index to its slots. */
export interface Pick {
  choice: PilotChoice;
  equip: (string | null)[];
}

export const newPick = (choice: PilotChoice): Pick => ({
  choice,
  equip: choice.slots.map(() => null),
});

/** In-progress squad draft — kept in a store so it survives flyout tab swaps. */
interface BuilderState {
  editing: null | 'new' | string;
  faction: FactionId;
  picks: Pick[];
  name: string;
  setEditing: (e: null | 'new' | string) => void;
  setFaction: (f: FactionId) => void;
  setPicks: (p: Pick[]) => void;
  setName: (n: string) => void;
}

export const useBuilder = create<BuilderState>((set) => ({
  editing: null,
  faction: 'rebel',
  picks: [],
  name: '',
  setEditing: (editing) => set({ editing }),
  setFaction: (faction) => set({ faction }),
  setPicks: (picks) => set({ picks }),
  setName: (name) => set({ name }),
}));
