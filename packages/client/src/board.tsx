import { applyManeuver, BASE_MM, type PlayerView, type Position, type Ship } from '@xwing/engine';
import type { ReactElement } from 'react';

export interface BoardProps {
  view: PlayerView;
  activeId?: string | null;
  highlightIds?: string[];
  /** Ghost outline showing where a ship's revealed dial will land. */
  preview?: { shipId: string; pos: Position } | null;
  onPick?: (id: string) => void;
}

/** Swappable renderer contract — a 3D react-three-fiber variant can drop in behind this. */
export type BoardRenderer = (props: BoardProps) => ReactElement;

const colorFor = (view: PlayerView, ship: Ship): string => {
  const idx = view.players.findIndex((p) => p.id === ship.ownerId);
  return idx === 0 ? '#3fe0c5' : '#f7c457';
};

const TOKEN_COLOR: Record<string, string> = {
  focus: '#f7c457',
  evade: '#3fe0c5',
  stress: '#ef6f6f',
  lock: '#c0c6dd',
};

function tokenCounts(ship: Ship): [string, number][] {
  const counts: Record<string, number> = {};
  for (const t of ship.tokens) counts[t.kind] = (counts[t.kind] ?? 0) + 1;
  return Object.entries(counts);
}

function ShipBody({
  w,
  color,
  stroke,
}: {
  w: number;
  color: string;
  stroke: number;
}): ReactElement {
  return (
    <>
      <rect
        x={-w / 2}
        y={-w / 2}
        width={w}
        height={w}
        rx={4}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={stroke}
      />
      <polygon points={`0,${-w / 2 - 10} -7,${-w / 2} 7,${-w / 2}`} fill={color} />
    </>
  );
}

/** 2D SVG board: ships as bases with a nose, mapped from world mm (y-up) to screen (y-down). */
export const SvgBoard: BoardRenderer = ({ view, activeId, highlightIds = [], preview, onPick }) => {
  const ships = view.ships.filter((s) => s.hull > 0);
  const previewShip = preview ? ships.find((s) => s.id === preview.shipId) : undefined;

  return (
    <svg className="board" viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid meet">
      <rect x={-460} y={-460} width={920} height={920} rx={16} className="mat" />

      {previewShip && preview && (
        <g
          transform={`translate(${preview.pos.x} ${-preview.pos.y}) rotate(${preview.pos.angle})`}
          opacity={0.4}
        >
          <rect
            x={-BASE_MM[previewShip.base] / 2}
            y={-BASE_MM[previewShip.base] / 2}
            width={BASE_MM[previewShip.base]}
            height={BASE_MM[previewShip.base]}
            rx={4}
            fill="none"
            stroke={colorFor(view, previewShip)}
            strokeWidth={2}
            strokeDasharray="6 5"
          />
        </g>
      )}

      {ships.map((s) => {
        const w = BASE_MM[s.base];
        const color = colorFor(view, s);
        const active = s.id === activeId;
        const highlight = highlightIds.includes(s.id);
        return (
          <g
            key={s.id}
            onClick={() => onPick?.(s.id)}
            style={{ cursor: onPick ? 'pointer' : 'default' }}
          >
            {active && <circle cx={s.pos.x} cy={-s.pos.y} r={w / 2 + 14} className="activeRing" />}
            <g transform={`translate(${s.pos.x} ${-s.pos.y}) rotate(${s.pos.angle})`}>
              <ShipBody w={w} color={color} stroke={active ? 4 : highlight ? 3 : 2} />
            </g>
            <text x={s.pos.x} y={-s.pos.y + 5} textAnchor="middle" className="shipLabel">
              {s.id} · {s.hull}
              {s.maxShields > 0 ? `+${s.shields}` : ''}
            </text>
            <text x={s.pos.x} y={-s.pos.y + w / 2 + 26} textAnchor="middle" className="tokenRow">
              {tokenCounts(s).map(([kind, n], i) => (
                <tspan key={kind} fill={TOKEN_COLOR[kind]} dx={i === 0 ? 0 : 8}>
                  {kind[0]!.toUpperCase()}
                  {n > 1 ? n : ''}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/** Compute the landing ghost for a ship that has revealed its dial. */
export function previewFor(view: PlayerView, shipId: string | undefined): BoardProps['preview'] {
  if (!shipId) return null;
  const ship = view.ships.find((s) => s.id === shipId);
  if (!ship?.dial) return null;
  return { shipId, pos: applyManeuver(ship.pos, ship.dial) };
}
