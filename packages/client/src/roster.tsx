import type { PlayerView, Ship } from '@xwing/engine';
import type { ReactElement } from 'react';

const SIDE = ['#3fe0c5', '#f7c457'];
const TOKEN: Record<string, string> = {
  focus: '#4ade80',
  evade: '#3fe0c5',
  stress: '#ef6f6f',
  lock: '#c0c6dd',
};

function Pips({
  filled,
  max,
  color,
  label,
}: {
  filled: number;
  max: number;
  color: string;
  label: string;
}): ReactElement {
  return (
    <span className="pips" aria-label={`${label}: ${filled} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="pip"
          style={{ background: i < filled ? color : 'transparent', borderColor: color }}
        />
      ))}
    </span>
  );
}

function ShipStatus({ ship, color }: { ship: Ship; color: string }): ReactElement {
  const dead = ship.hull <= 0;
  const counts: Record<string, number> = {};
  for (const t of ship.tokens) counts[t.kind] = (counts[t.kind] ?? 0) + 1;

  return (
    <div className={dead ? 'shipStatus dead' : 'shipStatus'}>
      <span className="shipStatusName">
        {ship.pilot} <span className="muted">· {ship.id}</span>
      </span>
      {dead ? (
        <span className="muted">destroyed</span>
      ) : (
        <span className="shipStatusBars">
          <Pips filled={ship.hull} max={ship.maxHull} color={color} label="hull" />
          {ship.maxShields > 0 && (
            <Pips filled={ship.shields} max={ship.maxShields} color="#9bd2ff" label="shields" />
          )}
          {ship.maxCharges > 0 && (
            <Pips filled={ship.charges} max={ship.maxCharges} color="#f0a830" label="charges" />
          )}
          {Object.entries(counts).map(([k, n]) => (
            <span key={k} className="chip" style={{ borderColor: TOKEN[k], color: TOKEN[k] }}>
              {k}
              {n > 1 ? ` ${n}` : ''}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/** Clean per-side fleet status — health and tokens at a glance. */
export function Roster({ view }: { view: PlayerView }): ReactElement {
  return (
    <div className="panel rosterPanel">
      {view.players.map((p, idx) => (
        <div key={p.id} className="rosterSide">
          <div className="rosterSideHead" style={{ color: SIDE[idx % 2] }}>
            {p.name}
          </div>
          {view.ships
            .filter((s) => s.ownerId === p.id)
            .map((s) => (
              <ShipStatus key={s.id} ship={s} color={SIDE[idx % 2]!} />
            ))}
        </div>
      ))}
    </div>
  );
}
