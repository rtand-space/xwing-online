import type { XwsSquad } from '@xwing/data';
import { create } from 'zustand';
import { useAuth } from './auth';
import {
  deleteSquad as apiDelete,
  listSquads,
  saveSquad as apiSave,
  type SavedSquad,
} from './squads';

const KEY = 'xwing:squads';
const readLocal = (): SavedSquad[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedSquad[];
  } catch {
    return [];
  }
};
const writeLocal = (s: SavedSquad[]) => localStorage.setItem(KEY, JSON.stringify(s));

interface SquadsState {
  squads: SavedSquad[];
  /** Reload: signed-in pulls from the server (migrating any local-only squads up first). */
  refresh: () => Promise<void>;
  save: (name: string, faction: string, xws: XwsSquad, id?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useSquads = create<SquadsState>((set, get) => ({
  squads: readLocal(),
  refresh: async () => {
    if (!useAuth.getState().token) {
      set({ squads: readLocal() });
      return;
    }
    const server = await listSquads();
    const ids = new Set(server.map((s) => s.id));
    for (const s of readLocal().filter((s) => !ids.has(s.id))) {
      await apiSave(s.name, s.faction, s.xws, s.id);
    }
    const merged = ids.size < readLocal().length ? await listSquads() : server;
    writeLocal(merged);
    set({ squads: merged });
  },
  save: async (name, faction, xws, id) => {
    const entry: SavedSquad = {
      id: id ?? crypto.randomUUID(),
      name,
      faction,
      xws,
      updated_at: Date.now(),
    };
    const next = [entry, ...get().squads.filter((s) => s.id !== entry.id)];
    writeLocal(next);
    set({ squads: next });
    if (useAuth.getState().token) await apiSave(entry.name, entry.faction, entry.xws, entry.id);
  },
  remove: async (id) => {
    const next = get().squads.filter((s) => s.id !== id);
    writeLocal(next);
    set({ squads: next });
    if (useAuth.getState().token) await apiDelete(id);
  },
}));
