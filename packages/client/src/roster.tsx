import type { PlayerView, Ship } from '@xwing/engine';
import type { ReactElement } from 'react';

const SIDE = ['#3fe0c5', '#f7c457'];
const TOKEN: Record<string, string> = {
  focus: '#4ade80',
  evade: '#3fe0c5',
  stress: '#ef6f6f',
  lock: '#c0c6dd',
  calculate: '#9b8cff',
  reinforce: '#f0a830',
  ion: '#ef6f6f',
  tractor: '#f0a830',
  disarm: '#f0a830',
  strain: '#ef6f6f',
  deplete: '#ef6f6f',
  jam: '#f0a830',
  cloak: '#6fb8ef',
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
      {!dead && (
        <span className="shipStatusStats">
          <span title="initiative">init {ship.initiative}</span>
          <span title="attack dice">atk {ship.primaryAttack}</span>
          <span title="agility (defence dice)">agi {ship.agility}</span>
        </span>
      )}
      {dead ? (
        <span className="muted">destroyed</span>
      ) : (
        <span className="shipStatusBars">
          <Pips filled={ship.hull} max={ship.maxHull} color={color} label="hull" />
          {ship.maxShields > 0 && (
            <Pips filled={ship.shields} max={ship.maxShields} color="#9bd2ff" label="shields" />
          )}
          {(() => {
            const pools = Object.values(ship.upgradeCharges ?? {});
            const cur = ship.charges + pools.reduce((n, p) => n + p.charges, 0);
            const max = ship.maxCharges + pools.reduce((n, p) => n + p.max, 0);
            return max > 0 ? <Pips filled={cur} max={max} color="#f0a830" label="charges" /> : null;
          })()}
          {(ship.maxForce ?? 0) > 0 && (
            <Pips filled={ship.force ?? 0} max={ship.maxForce ?? 0} color="#b18bff" label="force" />
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
