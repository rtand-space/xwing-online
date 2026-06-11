import type { ActionType, Command, Maneuver, PlayerView } from '@xwing/engine';
import type { ReactElement } from 'react';
import { useGame } from './store';

const DIFFICULTY: Record<Maneuver['difficulty'], string> = {
  blue: '#5bd6a8',
  white: '#d6dae8',
  red: '#ef6f6f',
};

const BEARING: Record<Maneuver['bearing'], string> = {
  straight: 'straight',
  'bank-left': 'bank L',
  'bank-right': 'bank R',
  'turn-left': 'turn L',
  'turn-right': 'turn R',
  koiogran: 'K-turn',
  stationary: 'stop',
};

const ACTION: Record<ActionType, string> = {
  focus: 'Focus',
  lock: 'Lock',
  'barrel-roll': 'Barrel Roll',
  boost: 'Boost',
  evade: 'Evade',
};

export function Controls({
  view,
  onSend,
}: {
  view: PlayerView;
  onSend?: (command: Command) => void;
}): ReactElement {
  const localSend = useGame((s) => s.send);
  const send = onSend ?? localSend;
  const p = view.pending[0];
  const ship = p ? view.ships.find((s) => s.id === p.shipId) : undefined;

  if (!p || !ship) return <div className="muted">Resolving…</div>;

  return (
    <div className="controls">
      <div className="panelHead">
        <span className="tag">{ship.id}</span> {labelFor(p.type)}
      </div>

      {p.type === 'set-dial' && (
        <div className="grid">
          {p.options.maneuvers.map((m, i) => (
            <button
              key={i}
              className="btn"
              onClick={() =>
                send({ type: 'SetDial', playerId: p.playerId, shipId: p.shipId, maneuver: m })
              }
            >
              <span className="dot" style={{ background: DIFFICULTY[m.difficulty] }} />
              {m.speed} {BEARING[m.bearing]}
            </button>
          ))}
        </div>
      )}

      {p.type === 'execute-maneuver' && (
        <div className="grid">
          <div className="muted">
            Dial: {ship.dial ? `${ship.dial.speed} ${BEARING[ship.dial.bearing]}` : '—'}
          </div>
          <button
            className="btn primary"
            onClick={() =>
              send({ type: 'ExecuteManeuver', playerId: p.playerId, shipId: p.shipId })
            }
          >
            Execute maneuver
          </button>
        </div>
      )}

      {p.type === 'perform-action' && (
        <div className="grid">
          {p.options.actions.length === 0 && <div className="muted">Stressed — no actions.</div>}
          {p.options.actions
            .filter((a) => a !== 'lock')
            .map((a) => (
              <button
                key={a}
                className="btn"
                onClick={() =>
                  send({ type: 'PerformAction', playerId: p.playerId, shipId: p.shipId, action: a })
                }
              >
                {ACTION[a]}
              </button>
            ))}
          {p.options.actions.includes('lock') &&
            p.options.lockTargets.map((t) => (
              <button
                key={`lock-${t}`}
                className="btn"
                onClick={() =>
                  send({
                    type: 'PerformAction',
                    playerId: p.playerId,
                    shipId: p.shipId,
                    action: 'lock',
                    targetId: t,
                  })
                }
              >
                Lock {t}
              </button>
            ))}
          <button
            className="btn ghost"
            onClick={() => send({ type: 'SkipAction', playerId: p.playerId, shipId: p.shipId })}
          >
            Skip action
          </button>
        </div>
      )}

      {p.type === 'declare-attack' && (
        <div className="grid">
          {p.options.targets.length === 0 && <div className="muted">No target in arc/range.</div>}
          {p.options.targets.map((t) => (
            <button
              key={t}
              className="btn primary"
              onClick={() =>
                send({ type: 'DeclareAttack', playerId: p.playerId, shipId: p.shipId, targetId: t })
              }
            >
              Attack {t}
            </button>
          ))}
          <button
            className="btn ghost"
            onClick={() => send({ type: 'PassAttack', playerId: p.playerId, shipId: p.shipId })}
          >
            Pass
          </button>
        </div>
      )}
    </div>
  );
}

function labelFor(type: PlayerView['pending'][number]['type']): string {
  switch (type) {
    case 'set-dial':
      return 'Set your maneuver';
    case 'execute-maneuver':
      return 'Reveal & move';
    case 'perform-action':
      return 'Choose an action';
    case 'declare-attack':
      return 'Declare attack';
  }
}
