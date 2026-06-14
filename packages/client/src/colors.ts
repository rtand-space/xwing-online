import type { PlayerView } from '@xwing/engine';

/** The lobby colour palette players choose from. */
export const PALETTE: { id: string; hex: string }[] = [
  { id: 'teal', hex: '#3fe0c5' },
  { id: 'amber', hex: '#f7c457' },
  { id: 'violet', hex: '#9b8cff' },
  { id: 'rose', hex: '#ef6f9b' },
  { id: 'mint', hex: '#5bd6a8' },
  { id: 'sky', hex: '#6fb8ef' },
  { id: 'orange', hex: '#f0a830' },
  { id: 'crimson', hex: '#ef6f6f' },
];

/** Fallback colours by seat index when a player has none (older games / local play). */
const DEFAULT = ['#3fe0c5', '#f7c457'];

/** A player's display colour from the view (their chosen colour, else a seat default). */
export function playerColor(view: PlayerView | null, id: string | null): string {
  if (!view || id == null) return '#8a92b4';
  const i = view.players.findIndex((p) => p.id === id);
  return view.players[i]?.color ?? DEFAULT[i] ?? '#8a92b4';
}
