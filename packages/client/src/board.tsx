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

const COLORS = ['#3fe0c5', '#f7c457'];

const sideIndex = (view: PlayerView, ship: Ship): number =>
  Math.max(
    0,
    view.players.findIndex((p) => p.id === ship.ownerId),
  );

const colorFor = (view: PlayerView, ship: Ship): string => COLORS[sideIndex(view, ship) % 2]!;

/** Per-faction base gradients and soft glow filters — a temporary "miniature" look. */
function ShipDefs(): ReactElement {
  return (
    <defs>
      {COLORS.map((c, i) => (
        <radialGradient key={`grad${i}`} id={`base${i}`} cx="50%" cy="38%" r="68%">
          <stop offset="0%" stopColor={c} stopOpacity="0.55" />
          <stop offset="70%" stopColor={c} stopOpacity="0.16" />
          <stop offset="100%" stopColor={c} stopOpacity="0.05" />
        </radialGradient>
      ))}
      {COLORS.map((c, i) => (
        <filter key={`flt${i}`} id={`glow${i}`} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={c} floodOpacity="0.55" />
        </filter>
      ))}
    </defs>
  );
}

const TOKEN_COLOR: Record<string, string> = {
  focus: '#f7c457',
  evade: '#3fe0c5',
  stress: '#ef6f6f',
  lock: '#c0c6dd',
};

/** Deterministic scattered starfield so the play area reads as deep space. */
const STARS = Array.from({ length: 150 }, (_, i) => ({
  x: ((i * 167.3) % 1000) - 500,
  y: ((i * 263.1) % 1000) - 500,
  r: i % 11 === 0 ? 1.8 : i % 4 === 0 ? 1.1 : 0.6,
  o: 0.25 + ((i * 53) % 60) / 100,
}));

function Starfield(): ReactElement {
  return (
    <>
      <defs>
        <radialGradient id="neb-a" cx="28%" cy="24%" r="62%">
          <stop offset="0%" stopColor="#7c6cf0" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#7c6cf0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="neb-b" cx="76%" cy="82%" r="58%">
          <stop offset="0%" stopColor="#3fe0c5" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#3fe0c5" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={-500} y={-500} width={1000} height={1000} fill="#05070f" />
      <rect x={-500} y={-500} width={1000} height={1000} fill="url(#neb-a)" />
      <rect x={-500} y={-500} width={1000} height={1000} fill="url(#neb-b)" />
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.o} />
      ))}
    </>
  );
}

function tokenCounts(ship: Ship): [string, number][] {
  const counts: Record<string, number> = {};
  for (const t of ship.tokens) counts[t.kind] = (counts[t.kind] ?? 0) + 1;
  return Object.entries(counts);
}

function ShipBody({
  w,
  color,
  fill,
  glow,
  stroke,
}: {
  w: number;
  color: string;
  fill: string;
  glow: string;
  stroke: number;
}): ReactElement {
  return (
    <g filter={glow}>
      <rect
        x={-w / 2}
        y={-w / 2}
        width={w}
        height={w}
        rx={6}
        fill={fill}
        stroke={color}
        strokeWidth={stroke}
      />
      <polygon points={`0,${-w / 2 - 11} -8,${-w / 2 + 2} 8,${-w / 2 + 2}`} fill={color} />
      <circle cx={0} cy={-w / 6} r={w / 9} fill={color} fillOpacity={0.85} />
    </g>
  );
}

/** 2D SVG board: ships as bases with a nose, mapped from world mm (y-up) to screen (y-down). */
export const SvgBoard: BoardRenderer = ({ view, activeId, highlightIds = [], preview, onPick }) => {
  const ships = view.ships.filter((s) => s.hull > 0);
  const previewShip = preview ? ships.find((s) => s.id === preview.shipId) : undefined;

  return (
    <svg className="board" viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid meet">
      <Starfield />
      <ShipDefs />
      <rect x={-498} y={-498} width={996} height={996} rx={16} className="mat" />

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
        const side = sideIndex(view, s);
        const color = colorFor(view, s);
        const active = s.id === activeId;
        const highlight = highlightIds.includes(s.id);

        const total = s.maxHull + s.maxShields;
        const hullW = total ? (w * s.hull) / total : 0;
        const shieldW = total ? (w * s.shields) / total : 0;
        const barX = s.pos.x - w / 2;
        const barY = -s.pos.y + w / 2 + 6;
        const tokens = tokenCounts(s);
        const tokenSpan = (tokens.length - 1) * 10;

        return (
          <g
            key={s.id}
            onClick={() => onPick?.(s.id)}
            style={{ cursor: onPick ? 'pointer' : 'default' }}
          >
            {active && <circle cx={s.pos.x} cy={-s.pos.y} r={w / 2 + 14} className="activeRing" />}
            <g transform={`translate(${s.pos.x} ${-s.pos.y}) rotate(${s.pos.angle})`}>
              <ShipBody
                w={w}
                color={color}
                fill={`url(#base${side})`}
                glow={`url(#glow${side})`}
                stroke={active ? 3.5 : highlight ? 3 : 2}
              />
            </g>

            {/* token dots above the base */}
            {tokens.map(([kind], i) => (
              <circle
                key={kind}
                cx={s.pos.x - tokenSpan / 2 + i * 10}
                cy={-s.pos.y - w / 2 - 10}
                r={3.5}
                fill={TOKEN_COLOR[kind]}
              />
            ))}

            {/* hull (faction) + shield (blue) bar below the base */}
            <rect x={barX} y={barY} width={w} height={4} rx={2} fill="rgba(255,255,255,0.14)" />
            <rect x={barX} y={barY} width={hullW} height={4} rx={2} fill={color} />
            <rect x={barX + hullW} y={barY} width={shieldW} height={4} rx={2} fill="#9bd2ff" />

            <text x={s.pos.x} y={barY + 18} textAnchor="middle" className="shipLabel">
              {s.id}
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
