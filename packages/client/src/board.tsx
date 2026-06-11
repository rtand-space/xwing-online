import { BASE_MM, type PlayerView, type Ship } from '@xwing/engine';
import type { ReactElement } from 'react';

export interface BoardProps {
  view: PlayerView;
  selectedId?: string | null;
  highlightIds?: string[];
  onPick?: (id: string) => void;
}

/** Swappable renderer contract — a 3D react-three-fiber variant can drop in behind this. */
export type BoardRenderer = (props: BoardProps) => ReactElement;

const colorFor = (view: PlayerView, ship: Ship): string => {
  const idx = view.players.findIndex((p) => p.id === ship.ownerId);
  return idx === 0 ? '#3fe0c5' : '#f7c457';
};

/** 2D SVG board: ships as bases with a nose, mapped from world mm (y-up) to screen (y-down). */
export const SvgBoard: BoardRenderer = ({ view, selectedId, highlightIds = [], onPick }) => {
  const ships = view.ships.filter((s) => s.hull > 0);
  return (
    <svg className="board" viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid meet">
      <rect x={-460} y={-460} width={920} height={920} rx={16} className="mat" />
      {ships.map((s) => {
        const w = BASE_MM[s.base];
        const color = colorFor(view, s);
        const selected = s.id === selectedId;
        const highlight = highlightIds.includes(s.id);
        return (
          <g
            key={s.id}
            onClick={() => onPick?.(s.id)}
            style={{ cursor: onPick ? 'pointer' : 'default' }}
          >
            <g transform={`translate(${s.pos.x} ${-s.pos.y}) rotate(${s.pos.angle})`}>
              <rect
                x={-w / 2}
                y={-w / 2}
                width={w}
                height={w}
                rx={4}
                fill={color}
                fillOpacity={0.18}
                stroke={color}
                strokeWidth={selected ? 4 : highlight ? 3 : 2}
                strokeDasharray={highlight ? '6 4' : undefined}
              />
              <polygon points={`0,${-w / 2 - 10} -7,${-w / 2} 7,${-w / 2}`} fill={color} />
            </g>
            <text x={s.pos.x} y={-s.pos.y + 4} textAnchor="middle" className="shipLabel">
              {s.id} · {s.hull}
              {s.maxShields > 0 ? `+${s.shields}` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
