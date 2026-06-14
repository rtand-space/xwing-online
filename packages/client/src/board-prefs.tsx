import { type ReactElement } from 'react';
import { create } from 'zustand';
import { PALETTE } from './colors';

const COLOR_KEY = 'xwing:playerColor';
const initialColor = (): string => localStorage.getItem(COLOR_KEY) ?? PALETTE[0]!.hex;

/** Board display preferences shared by the game and sandbox boards. */
interface BoardPrefs {
  showNames: boolean;
  toggleNames: () => void;
  /** The player's chosen lobby colour (persisted). */
  color: string;
  setColor: (hex: string) => void;
}

export const useBoardPrefs = create<BoardPrefs>((set) => ({
  showNames: true,
  toggleNames: () => set((s) => ({ showNames: !s.showNames })),
  color: initialColor(),
  setColor: (color) => {
    localStorage.setItem(COLOR_KEY, color);
    set({ color });
  },
}));

/** A flyout row toggle for floating ship-name cards (game + sandbox). */
export function NamesToggle(): ReactElement {
  const showNames = useBoardPrefs((s) => s.showNames);
  const toggle = useBoardPrefs((s) => s.toggleNames);
  return (
    <label className="rosterRow">
      <span>Show ship names</span>
      <input type="checkbox" checked={showNames} onChange={toggle} />
    </label>
  );
}

/** A settings-row colour picker for the player's lobby colour. */
export function ColorPicker(): ReactElement {
  const color = useBoardPrefs((s) => s.color);
  const setColor = useBoardPrefs((s) => s.setColor);
  return (
    <div className="rosterRow">
      <span>Your colour</span>
      <div className="colorPick">
        {PALETTE.map((c) => (
          <button
            key={c.id}
            className={`swatch${color === c.hex ? ' on' : ''}`}
            style={{ background: c.hex }}
            aria-label={c.id}
            aria-pressed={color === c.hex}
            onClick={() => setColor(c.hex)}
          />
        ))}
      </div>
    </div>
  );
}
