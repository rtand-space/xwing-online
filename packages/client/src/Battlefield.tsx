import { obstacleValidity, placementOk } from '@xwing/data';
import type { ReactElement } from 'react';
import { useSetup } from './setup-store';

/** Bottom HUD for the pre-game obstacle placement step. */
export function Battlefield(): ReactElement {
  const obstacles = useSetup((s) => s.obstacles);
  const shuffle = useSetup((s) => s.shuffle);
  const confirm = useSetup((s) => s.confirm);
  const cancel = useSetup((s) => s.cancel);
  const ok = placementOk(obstacles);
  const invalid = Object.values(obstacleValidity(obstacles)).filter((v) => !v).length;

  return (
    <div className="battlefield">
      <div className="bfTitle">
        Place obstacles <span className="muted">— drag to move</span>
      </div>
      <div className="muted">
        {ok
          ? 'All clear. Begin when ready.'
          : `${invalid} too close to an edge or another obstacle`}
      </div>
      <div className="grid">
        <button className="btn sm" onClick={shuffle}>
          Shuffle
        </button>
        <button className="btn sm ghost" onClick={cancel}>
          Cancel
        </button>
        <button className="btn primary" disabled={!ok} onClick={confirm}>
          Begin battle
        </button>
      </div>
    </div>
  );
}
