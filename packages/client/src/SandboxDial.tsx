import { getShip } from '@xwing/data';
import { type ReactElement, useState } from 'react';
import { ManeuverDial } from './controls';
import { useSandbox } from './sandbox-store';

/** Bottom HUD in sandbox: the selected ship's dial + rotate/remove, collapsible. */
export function SandboxDial(): ReactElement | null {
  const ships = useSandbox((s) => s.ships);
  const selectedId = useSandbox((s) => s.selectedId);
  const execute = useSandbox((s) => s.execute);
  const rotate = useSandbox((s) => s.rotate);
  const remove = useSandbox((s) => s.remove);
  const [collapsed, setCollapsed] = useState(false);
  const sel = ships.find((s) => s.id === selectedId);
  if (!sel) return null;

  return (
    <div className={`flyout bottom open${collapsed ? ' collapsed' : ''}`}>
      <button
        className="hudHandle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Show dial' : 'Hide dial'}
      >
        <span className="hudTitle">
          {getShip(sel.shipType).name} · {sel.pilot}
        </span>
        <span className="chev">{collapsed ? '▲' : '▾'}</span>
      </button>
      {!collapsed && (
        <div className="flyoutBody">
          <ManeuverDial options={sel.dialOptions} onPick={execute} />
          <div className="grid">
            <button className="btn sm" onClick={() => rotate(-90)}>
              ⟲ 90
            </button>
            <button className="btn sm" onClick={() => rotate(-15)}>
              ⟲ 15
            </button>
            <button className="btn sm" onClick={() => rotate(15)}>
              15 ⟳
            </button>
            <button className="btn sm" onClick={() => rotate(90)}>
              90 ⟳
            </button>
            <button className="btn sm ghost" onClick={remove}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
