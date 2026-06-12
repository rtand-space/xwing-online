import type { ActionType, Command, Maneuver, PlayerView } from '@xwing/engine';
import { Fragment, type ReactElement } from 'react';
import { useGame } from './store';

const DIFFICULTY: Record<Maneuver['difficulty'], string> = {
  blue: '#5bd6a8',
  white: '#d6dae8',
  red: '#ef6f6f',
  purple: '#b18bff',
};

const BEARING: Record<Maneuver['bearing'], string> = {
  straight: 'straight',
  'bank-left': 'bank L',
  'bank-right': 'bank R',
  'turn-left': 'turn L',
  'turn-right': 'turn R',
  koiogran: 'K-turn',
  'segnors-loop-left': "Segnor's L",
  'segnors-loop-right': "Segnor's R",
  'tallon-roll-left': 'Tallon L',
  'tallon-roll-right': 'Tallon R',
  'reverse-straight': 'reverse',
  'reverse-bank-left': 'rev bank L',
  'reverse-bank-right': 'rev bank R',
  stationary: 'stop',
};

// Dial layout: bearing columns left→right, speed rows top→bottom (like the real dial).
// Columns only render when the ship's dial actually uses them.
const DIAL_COLS: { key: Maneuver['bearing']; glyph: string }[] = [
  { key: 'tallon-roll-left', glyph: '⤽' },
  { key: 'segnors-loop-left', glyph: '↺' },
  { key: 'turn-left', glyph: '↰' },
  { key: 'bank-left', glyph: '↖' },
  { key: 'reverse-bank-left', glyph: '↙' },
  { key: 'straight', glyph: '↑' },
  { key: 'reverse-straight', glyph: '↓' },
  { key: 'reverse-bank-right', glyph: '↘' },
  { key: 'bank-right', glyph: '↗' },
  { key: 'turn-right', glyph: '↱' },
  { key: 'segnors-loop-right', glyph: '↻' },
  { key: 'tallon-roll-right', glyph: '⤼' },
  { key: 'koiogran', glyph: '⟲' },
  { key: 'stationary', glyph: '■' },
];

export function ManeuverDial({
  options,
  onPick,
}: {
  options: Maneuver[];
  onPick: (m: Maneuver) => void;
}): ReactElement {
  // only render columns/speeds that this ship actually has
  const cols = DIAL_COLS.filter((c) => options.some((o) => o.bearing === c.key));
  const speeds = [...new Set(options.map((m) => m.speed))].sort((a, b) => b - a);

  return (
    <div className="dialGrid" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 40px)` }}>
      {speeds.map((speed) => (
        <Fragment key={speed}>
          <div className="dialSpeed">{speed}</div>
          {cols.map((c) => {
            const m = options.find((o) => o.speed === speed && o.bearing === c.key);
            return m ? (
              <button
                key={c.key}
                className="dialCell"
                style={{ color: DIFFICULTY[m.difficulty], borderColor: DIFFICULTY[m.difficulty] }}
                onClick={() => onPick(m)}
                aria-label={`speed ${speed} ${c.key} ${m.difficulty}`}
              >
                {c.glyph}
              </button>
            ) : (
              <span key={c.key} className="dialCell empty" />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

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

  const name = ship.id.replace(/-/g, ' ');

  return (
    <div className="controls">
      <div className="panelHead">{labelFor(p.type, name)}</div>

      {p.type === 'set-dial' && (
        <ManeuverDial
          options={p.options.maneuvers}
          onPick={(m) =>
            send({ type: 'SetDial', playerId: p.playerId, shipId: p.shipId, maneuver: m })
          }
        />
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

function labelFor(type: PlayerView['pending'][number]['type'], name: string): string {
  switch (type) {
    case 'set-dial':
      return `Set dial for ${name}`;
    case 'execute-maneuver':
      return `Reveal & move ${name}`;
    case 'perform-action':
      return `${name}: choose an action`;
    case 'declare-attack':
      return `${name}: declare attack`;
  }
}
