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

/** A distinct shape per token kind (not colour alone) above the base. */
function TokenMark({
  kind,
  n,
  cx,
  cy,
}: {
  kind: string;
  n: number;
  cx: number;
  cy: number;
}): ReactElement {
  const c = TOKEN_COLOR[kind] ?? '#fff';
  let shape: ReactElement;
  if (kind === 'evade') {
    shape = (
      <rect
        x={cx - 4}
        y={cy - 4}
        width={8}
        height={8}
        fill={c}
        transform={`rotate(45 ${cx} ${cy})`}
      />
    );
  } else if (kind === 'stress') {
    shape = (
      <polygon
        points={`${cx},${cy - 4.5} ${cx - 4.5},${cy + 3.5} ${cx + 4.5},${cy + 3.5}`}
        fill={c}
      />
    );
  } else if (kind === 'lock') {
    shape = (
      <rect x={cx - 4} y={cy - 4} width={8} height={8} fill="none" stroke={c} strokeWidth={1.6} />
    );
  } else {
    shape = <circle cx={cx} cy={cy} r={4} fill={c} />; // focus
  }
  return (
    <>
      {shape}
      {n > 1 && (
        <text x={cx + 6} y={cy + 3} className="tokenCount" fill={c}>
          {n}
        </text>
      )}
    </>
  );
}

const ARC_ANGLES = [-45, -30, -15, 0, 15, 30, 45];
const arcPolyline = (r: number): string =>
  ARC_ANGLES.map((a) => {
    const t = (a * Math.PI) / 180;
    return `${r * Math.sin(t)},${-r * Math.cos(t)}`;
  }).join(' ');

/** The active attacker's field of fire + range bands (1/2/3), drawn during Engagement. */
function CombatArc({ w, color }: { w: number; color: string }): ReactElement {
  const half = w / 2;
  const bands = [half + 100, half + 200, half + 300];
  const e = Math.SQRT1_2 * bands[2]!;
  return (
    <g>
      <polygon points={`0,0 ${-e},${-e} ${e},${-e}`} fill={color} fillOpacity={0.07} />
      <line x1={0} y1={0} x2={-e} y2={-e} stroke={color} strokeWidth={1.5} strokeOpacity={0.55} />
      <line x1={0} y1={0} x2={e} y2={-e} stroke={color} strokeWidth={1.5} strokeOpacity={0.55} />
      {bands.map((r, i) => (
        <g key={i}>
          <polyline
            points={arcPolyline(r)}
            fill="none"
            stroke={color}
            strokeWidth={1.2}
            strokeOpacity={0.45}
            strokeDasharray="5 5"
          />
          <text x={0} y={-r + 16} textAnchor="middle" className="rangeLabel" fill={color}>
            {i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

function ShipBody({
  w,
  color,
  fill,
  glow,
  stroke,
  active,
}: {
  w: number;
  color: string;
  fill: string;
  glow: string;
  stroke: number;
  active: boolean;
}): ReactElement {
  // Front firing arc: 90° wedge from the base centre through the two front corners
  // (forward is local -y). Drawn on the plate, projecting a base-length ahead.
  const reach = w * 0.95;
  const edge = Math.SQRT1_2 * reach; // ±45° components
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
      <polygon
        points={`0,0 ${-edge},${-edge} ${edge},${-edge}`}
        fill={color}
        fillOpacity={active ? 0.24 : 0.14}
      />
      <line
        x1={0}
        y1={0}
        x2={-edge}
        y2={-edge}
        stroke={color}
        strokeWidth={active ? 2 : 1.5}
        strokeOpacity={active ? 1 : 0.8}
      />
      <line
        x1={0}
        y1={0}
        x2={edge}
        y2={-edge}
        stroke={color}
        strokeWidth={active ? 2 : 1.5}
        strokeOpacity={active ? 1 : 0.8}
      />
      <circle cx={0} cy={0} r={2.5} fill={color} />
    </g>
  );
}

/** 2D SVG board: ships as bases with a front-arc wedge, mapped from world mm (y-up) to screen (y-down). */
export const SvgBoard: BoardRenderer = ({ view, activeId, highlightIds = [], preview, onPick }) => {
  const ships = view.ships.filter((s) => s.hull > 0);
  const previewShip = preview ? ships.find((s) => s.id === preview.shipId) : undefined;
  const attacker =
    view.phase === 'engagement' && activeId ? ships.find((s) => s.id === activeId) : undefined;

  return (
    <svg className="board" viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid meet">
      <Starfield />
      <ShipDefs />
      <rect x={-498} y={-498} width={996} height={996} rx={16} className="mat" />

      {attacker && (
        <g
          transform={`translate(${attacker.pos.x} ${-attacker.pos.y}) rotate(${attacker.pos.angle})`}
        >
          <CombatArc w={BASE_MM[attacker.base]} color={colorFor(view, attacker)} />
        </g>
      )}

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
        const tokenSpan = (tokens.length - 1) * 12;

        return (
          <g
            key={s.id}
            onClick={() => onPick?.(s.id)}
            style={{ cursor: onPick ? 'pointer' : 'default' }}
          >
            {active && (
              <circle
                cx={s.pos.x}
                cy={-s.pos.y}
                r={w / 2 + 14}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeDasharray="4 6"
                className="activeRing"
              />
            )}
            <g transform={`translate(${s.pos.x} ${-s.pos.y}) rotate(${s.pos.angle})`}>
              <ShipBody
                w={w}
                color={color}
                fill={`url(#base${side})`}
                glow={`url(#glow${side})`}
                stroke={active ? 3.5 : highlight ? 3 : 2}
                active={active}
              />
            </g>

            {/* token shapes above the base */}
            {tokens.map(([kind, n], i) => (
              <TokenMark
                key={kind}
                kind={kind}
                n={n}
                cx={s.pos.x - tokenSpan / 2 + i * 12}
                cy={-s.pos.y - w / 2 - 12}
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
