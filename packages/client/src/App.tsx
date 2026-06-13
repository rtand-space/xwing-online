import { obstacleValidity } from '@xwing/data';
import { EMPTY_STATE, inArc, projectView, rangeBand } from '@xwing/engine';
import { type ReactElement, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { Battlefield } from './Battlefield';
import { previewFor, SvgBoard } from './board';
import { BottomFlyout } from './BottomFlyout';
import { useOnline } from './online-store';
import { SandboxDial } from './SandboxDial';
import { useSandbox } from './sandbox-store';
import { useSetup } from './setup-store';
import { useSquads } from './squads-store';
import { SideFlyout } from './SideFlyout';
import { TopNav } from './TopNav';
import { useActiveGame } from './useActiveGame';

const EMPTY_VIEW = projectView(EMPTY_STATE, '');

export function App(): ReactElement {
  const ag = useActiveGame();
  const [sideOpen, setSideOpen] = useState(true);
  const [showNames, setShowNames] = useState(false);

  // Reconnect to an in-progress online game after a refresh.
  useEffect(() => void useOnline.getState().resume(), []);
  // Capture an OAuth redirect (#session=…) and load the signed-in user.
  useEffect(() => void useAuth.getState().init(), []);
  // Re-sync saved squads whenever sign-in state changes (migrates local → account).
  const user = useAuth((s) => s.user);
  useEffect(() => void useSquads.getState().refresh(), [user]);
  // Open the menu when there's nothing to play; get out of the way once a game starts.
  useEffect(() => setSideOpen(ag.mode === 'none'), [ag.mode]);

  const placing = useSetup((s) => s.active);
  const placeObstacles = useSetup((s) => s.obstacles);
  const moveObstacle = useSetup((s) => s.move);
  // Clear the menu out of the way during obstacle placement.
  useEffect(() => {
    if (placing) setSideOpen(false);
  }, [placing]);

  const sandbox = useSandbox((s) => s.active);
  const turnBased = useSandbox((s) => s.turnBased);
  const sbShips = useSandbox((s) => s.ships);
  const sbObstacles = useSandbox((s) => s.obstacles);
  const sbSelected = useSandbox((s) => s.selectedId);
  const sbShowArcs = useSandbox((s) => s.showArcs);
  const sbSelect = useSandbox((s) => s.select);
  const sbMove = useSandbox((s) => s.move);
  // Free editing mode: sandbox open but not (yet) playing turn-based.
  const sbEdit = sandbox && !turnBased;
  useEffect(() => {
    if (sandbox) setSideOpen(true);
  }, [sandbox]);

  const view = sbEdit
    ? { ...EMPTY_VIEW, ships: sbShips, obstacles: sbObstacles, phase: 'activation' as const }
    : placing
      ? { ...EMPTY_VIEW, obstacles: placeObstacles }
      : (ag.view ?? EMPTY_VIEW);
  const invalidObstacleIds = placing
    ? Object.entries(obstacleValidity(placeObstacles))
        .filter(([, ok]) => !ok)
        .map(([id]) => id)
    : [];
  // In sandbox edit mode, highlight ships in the selected ship's arc + range 3.
  const sel = sbEdit ? sbShips.find((s) => s.id === sbSelected) : undefined;
  const sandboxHighlights =
    sel && sbShowArcs
      ? sbShips
          .filter((t) => t.id !== sel.id && inArc(sel, t) && rangeBand(sel, t) !== null)
          .map((t) => t.id)
      : [];
  const pending = view.pending[0];
  const highlightIds =
    pending?.type === 'declare-attack'
      ? pending.options.targets
      : pending?.type === 'perform-action'
        ? pending.options.lockTargets
        : [];

  return (
    <div className="shell">
      <TopNav ag={ag} onToggleSide={() => setSideOpen((o) => !o)} />

      <div className="boardLayer">
        <SvgBoard
          view={view}
          activeId={sbEdit ? sbSelected : pending?.shipId}
          highlightIds={sbEdit ? sandboxHighlights : highlightIds}
          preview={
            !sbEdit && ag.myTurn && pending?.type === 'execute-maneuver'
              ? previewFor(view, pending.shipId)
              : null
          }
          placing={placing}
          invalidObstacleIds={invalidObstacleIds}
          onObstacleMove={moveObstacle}
          onShipMove={sbEdit ? sbMove : undefined}
          arcShipId={sbEdit && sbShowArcs ? sbSelected : undefined}
          onPick={sbEdit ? sbSelect : undefined}
          showNames={showNames}
        />
        <button
          className={showNames ? 'boardToggle on' : 'boardToggle'}
          onClick={() => setShowNames((v) => !v)}
          title="Toggle pilot names"
        >
          Names
        </button>
      </div>

      <SideFlyout open={sideOpen} onClose={() => setSideOpen(false)} ag={ag} />
      {placing && <Battlefield />}
      {sbEdit && <SandboxDial />}
      {!sbEdit && !placing && <BottomFlyout ag={ag} />}
    </div>
  );
}
