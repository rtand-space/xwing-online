import { EMPTY_STATE, projectView } from '@xwing/engine';
import { type ReactElement, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { previewFor, SvgBoard } from './board';
import { BottomFlyout } from './BottomFlyout';
import { useOnline } from './online-store';
import { useSquads } from './squads-store';
import { SideFlyout } from './SideFlyout';
import { TopNav } from './TopNav';
import { useActiveGame } from './useActiveGame';

const EMPTY_VIEW = projectView(EMPTY_STATE, '');

export function App(): ReactElement {
  const ag = useActiveGame();
  const [sideOpen, setSideOpen] = useState(true);

  // Reconnect to an in-progress online game after a refresh.
  useEffect(() => void useOnline.getState().resume(), []);
  // Capture an OAuth redirect (#session=…) and load the signed-in user.
  useEffect(() => void useAuth.getState().init(), []);
  // Re-sync saved squads whenever sign-in state changes (migrates local → account).
  const user = useAuth((s) => s.user);
  useEffect(() => void useSquads.getState().refresh(), [user]);
  // Open the menu when there's nothing to play; get out of the way once a game starts.
  useEffect(() => setSideOpen(ag.mode === 'none'), [ag.mode]);

  const view = ag.view ?? EMPTY_VIEW;
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
          activeId={pending?.shipId}
          highlightIds={highlightIds}
          preview={
            ag.myTurn && pending?.type === 'execute-maneuver'
              ? previewFor(view, pending.shipId)
              : null
          }
        />
      </div>

      <SideFlyout open={sideOpen} onClose={() => setSideOpen(false)} ag={ag} />
      <BottomFlyout ag={ag} />
    </div>
  );
}
