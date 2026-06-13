import { type ReactElement } from 'react';
import { create } from 'zustand';

/** Board display preferences shared by the game and sandbox boards. */
interface BoardPrefs {
  showNames: boolean;
  toggleNames: () => void;
}

export const useBoardPrefs = create<BoardPrefs>((set) => ({
  showNames: true,
  toggleNames: () => set((s) => ({ showNames: !s.showNames })),
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
