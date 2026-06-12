import { type ReactElement, useState } from 'react';
import { Account } from './Account';
import { formatEvent } from './log';
import { Roster } from './roster';
import { QuickPlay, SquadBuilder } from './setup';
import type { ActiveGame } from './useActiveGame';

type Tab = 'game' | 'squad' | 'log' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'game', label: 'Game' },
  { key: 'squad', label: 'Squad' },
  { key: 'log', label: 'Log' },
  { key: 'settings', label: 'Settings' },
];

export function SideFlyout({
  open,
  onClose,
  ag,
}: {
  open: boolean;
  onClose: () => void;
  ag: ActiveGame;
}): ReactElement {
  const [tab, setTab] = useState<Tab>('game');
  return (
    <>
      {open && <div className="backdrop" onClick={onClose} />}
      <aside className={open ? 'flyout side open' : 'flyout side'} aria-hidden={!open}>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'tab on' : 'tab'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flyoutBody">
          {tab === 'game' && (ag.mode === 'none' ? <QuickPlay /> : <GamePanel ag={ag} />)}
          {tab === 'squad' && <SquadBuilder />}
          {tab === 'log' && <LogTab ag={ag} />}
          {tab === 'settings' && (
            <div className="panelStack">
              <Account />
              <p className="muted">
                Reduced-motion and colour-blind-safe tokens are already respected.
              </p>
            </div>
          )}
        </div>
        <p className="disclaimer">
          Fan project — not endorsed by or affiliated with Atomic Mass Games. Go buy the real
          models.
        </p>
      </aside>
    </>
  );
}

function GamePanel({ ag }: { ag: ActiveGame }): ReactElement {
  const shareUrl = ag.code ? `${location.origin}?game=${ag.code}` : '';
  return (
    <div className="panelStack">
      <div className="panelHead">{ag.online ? 'Online game' : 'Hot-seat game'}</div>

      {ag.online && ag.isHost && ag.code && (
        <div className="panel">
          <div className="section">Invite a friend</div>
          <div className="codeBox">{shareUrl}</div>
          <div className="inviteRow">
            <span className="muted">
              code: <strong>{ag.code}</strong>
            </span>
            <button
              className="btn sm"
              onClick={() => void navigator.clipboard?.writeText(shareUrl)}
            >
              Copy link
            </button>
          </div>
        </div>
      )}

      {ag.onlineError && <div className="reject">{ag.onlineError}</div>}

      {ag.view && (
        <>
          <div className="section">Board state</div>
          <Roster view={ag.view} />
        </>
      )}

      <button className="btn ghost" onClick={ag.leave}>
        {ag.online ? 'Leave game' : 'New game'}
      </button>
    </div>
  );
}

function LogTab({ ag }: { ag: ActiveGame }): ReactElement {
  if (!ag.log) {
    return <p className="muted">Start a game to see the event log.</p>;
  }
  const lines = ag.log
    .map(formatEvent)
    .filter((l): l is string => l !== null)
    .slice(-50);
  return (
    <div className="logPanel">
      {lines.map((l: string, i: number) => (
        <div key={i} className="logLine">
          {l}
        </div>
      ))}
    </div>
  );
}
