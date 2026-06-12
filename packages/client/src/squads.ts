import type { XwsSquad } from '@xwing/data';
import { authHeader } from './auth';
import { SERVER } from './transport';

export interface SavedSquad {
  id: string;
  name: string;
  faction: string;
  xws: XwsSquad;
  updated_at: number;
}

export async function listSquads(): Promise<SavedSquad[]> {
  const r = await fetch(`${SERVER}/squads`, { headers: authHeader() });
  if (!r.ok) return [];
  return ((await r.json()) as { squads: SavedSquad[] }).squads;
}

export async function saveSquad(
  name: string,
  faction: string,
  xws: XwsSquad,
  id?: string,
): Promise<void> {
  await fetch(`${SERVER}/squads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader() },
    body: JSON.stringify({ id, name, faction, xws }),
  });
}

export async function deleteSquad(id: string): Promise<void> {
  await fetch(`${SERVER}/squads/${id}`, { method: 'DELETE', headers: authHeader() });
}
