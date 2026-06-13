import { applyManeuver, BASE_MM, type PlayerView, type Position, type Ship } from '@xwing/engine';
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from 'react';

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BOUND = 500;
const MIN_W = 260; // most zoomed in
const MAX_W = 2 * BOUND; // default (no zoom-out past the mat)

const clampVB = (v: ViewBox): ViewBox => ({
  w: v.w,
  h: v.h,
  x: Math.min(BOUND - v.w, Math.max(-BOUND, v.x)),
  y: Math.min(BOUND - v.h, Math.max(-BOUND, v.y)),
});

/** Pinch (touch) + ctrl/⌘-scroll zoom, drag to pan — by mutating the SVG viewBox. */
function usePanZoom(): {
  ref: React.RefObject<SVGSVGElement | null>;
  viewBox: string;
  onMouseDown: (e: ReactMouseEvent) => void;
} {
  const ref = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState<ViewBox>({ x: -BOUND, y: -BOUND, w: MAX_W, h: MAX_W });
  const vbRef = useRef(vb);
  vbRef.current = vb;
  const gesture = useRef<{ pinch?: number; px?: number; py?: number }>({});

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const apply = (next: ViewBox): void => setVb(clampVB(next));
    const zoomAt = (factor: number, cx: number, cy: number): void => {
      const r = svg.getBoundingClientRect();
      const v = vbRef.current;
      const fx = (cx - r.left) / r.width;
      const fy = (cy - r.top) / r.height;
      const nw = Math.min(MAX_W, Math.max(MIN_W, v.w * factor));
      apply({ x: v.x + fx * (v.w - nw), y: v.y + fy * (v.h - nw), w: nw, h: nw });
    };
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(e.deltaY > 0 ? 1.1 : 0.9, e.clientX, e.clientY);
    };
    const onTouchStart = (e: TouchEvent): void => {
      if (e.touches.length === 2) {
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        gesture.current = { pinch: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
      } else if (e.touches.length === 1) {
        gesture.current = { px: e.touches[0]!.clientX, py: e.touches[0]!.clientY };
      }
    };
    const onTouchMove = (e: TouchEvent): void => {
      const g = gesture.current;
      if (e.touches.length === 2 && g.pinch != null) {
        e.preventDefault();
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        zoomAt(g.pinch / d, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        gesture.current = { pinch: d };
      } else if (e.touches.length === 1 && g.px != null && g.py != null) {
        e.preventDefault();
        const r = svg.getBoundingClientRect();
        const v = vbRef.current;
        const t = e.touches[0]!;
        apply({
          ...v,
          x: v.x - ((t.clientX - g.px) / r.width) * v.w,
          y: v.y - ((t.clientY - g.py) / r.height) * v.h,
        });
        gesture.current = { px: t.clientX, py: t.clientY };
      }
    };
    const clear = (): void => {
      gesture.current = {};
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('touchstart', onTouchStart, { passive: false });
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    svg.addEventListener('touchend', clear);
    return () => {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('touchstart', onTouchStart);
      svg.removeEventListener('touchmove', onTouchMove);
      svg.removeEventListener('touchend', clear);
    };
  }, []);

  const onMouseDown = (e: ReactMouseEvent): void => {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const start = vbRef.current;
    const sx = e.clientX;
    const sy = e.clientY;
    const move = (ev: MouseEvent): void =>
      setVb(
        clampVB({
          ...start,
          x: start.x - ((ev.clientX - sx) / r.width) * start.w,
          y: start.y - ((ev.clientY - sy) / r.height) * start.h,
        }),
      );
    const up = (): void => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return { ref, viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`, onMouseDown };
}

export interface BoardProps {
  view: PlayerView;
  activeId?: string | null;
  highlightIds?: string[];
  /** Ghost outline showing where a ship's revealed dial will land. */
  preview?: { shipId: string; pos: Position } | null;
  onPick?: (id: string) => void;
  /** Obstacle-placement mode: drag obstacles; invalid ones are flagged. */
  placing?: boolean;
  invalidObstacleIds?: string[];
  onObstacleMove?: (id: string, x: number, y: number) => void;
  /** Sandbox: drag ships freely, and draw a firing arc for a chosen ship. */
  onShipMove?: (id: string, x: number, y: number) => void;
  arcShipId?: string | null;
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
  focus: '#4ade80',
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

/** A firing arc as a centre angle (from forward = 0°, right 90°, rear 180°, left 270°)
 *  and half-width. */
interface Wedge {
  center: number;
  half: number;
}
const FACING_DEG: Record<string, number> = { front: 0, right: 90, rear: 180, left: 270 };

/** The wedges a ship actually fires through, from its arcs + turret facing. */
function arcWedges(ship: Ship): Wedge[] {
  const arcs =
    ship.arcs && ship.arcs.length ? ship.arcs : [{ kind: 'front' as const, value: ship.primaryAttack }];
  const out: Wedge[] = [];
  for (const a of arcs) {
    if (a.kind === 'front') out.push({ center: 0, half: 45 });
    else if (a.kind === 'rear') out.push({ center: 180, half: 45 });
    else if (a.kind === 'full-front') out.push({ center: 0, half: 90 });
    else if (a.kind === 'bullseye') out.push({ center: 0, half: 5 });
    else if (a.kind === 'single-turret')
      out.push({ center: FACING_DEG[ship.turretArc ?? 'front']!, half: 45 });
    else if (a.kind === 'double-turret') {
      const lr = ship.turretArc === 'left' || ship.turretArc === 'right';
      out.push({ center: lr ? 90 : 0, half: 45 });
      out.push({ center: lr ? 270 : 180, half: 45 });
    }
  }
  return out;
}

const dir = (deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)]; // forward (0°) is screen -y
};
/** Points along an arc of radius r spanning a wedge. */
const arcPath = (r: number, w: Wedge): string => {
  const n = Math.max(2, Math.round(w.half / 5));
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const [dx, dy] = dir(w.center - w.half + (2 * w.half * i) / n);
    pts.push(`${r * dx},${r * dy}`);
  }
  return pts.join(' ');
};

/** The active/selected ship's actual fields of fire + range bands (1/2/3). */
function CombatArc({
  base,
  wedges,
  color,
}: {
  base: number;
  wedges: Wedge[];
  color: string;
}): ReactElement {
  const half = base / 2;
  const bands = [half + 100, half + 200, half + 300];
  const r3 = bands[2]!;
  return (
    <g>
      {wedges.map((wedge, wi) => (
        <g key={wi}>
          <polygon points={`0,0 ${arcPath(r3, wedge)}`} fill={color} fillOpacity={0.08} />
          {[wedge.center - wedge.half, wedge.center + wedge.half].map((edge, ei) => {
            const [dx, dy] = dir(edge);
            return (
              <line
                key={ei}
                x1={0}
                y1={0}
                x2={r3 * dx}
                y2={r3 * dy}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.55}
              />
            );
          })}
          {bands.map((r, i) => (
            <polyline
              key={i}
              points={arcPath(r, wedge)}
              fill="none"
              stroke={color}
              strokeWidth={1.2}
              strokeOpacity={0.4}
              strokeDasharray="5 5"
            />
          ))}
        </g>
      ))}
      {wedges[0] &&
        bands.map((r, i) => {
          const [dx, dy] = dir(wedges[0]!.center);
          return (
            <text
              key={i}
              x={dx * (r - 16)}
              y={dy * (r - 16)}
              textAnchor="middle"
              className="rangeLabel"
              fill={color}
            >
              {i + 1}
            </text>
          );
        })}
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
  wedges,
}: {
  w: number;
  color: string;
  fill: string;
  glow: string;
  stroke: number;
  active: boolean;
  wedges: Wedge[];
}): ReactElement {
  // A soft directional indicator per firing arc (front/rear/turret/…), kept near
  // the plate so a turret's facing reads at a glance.
  const r = w * 0.66;
  return (
    <g filter={glow}>
      {/* square base — exact game geometry */}
      <rect
        x={-w / 2}
        y={-w / 2}
        width={w}
        height={w}
        fill={fill}
        stroke={color}
        strokeWidth={stroke}
      />
      {wedges.map((wedge, i) => (
        <g key={i}>
          <polygon
            points={`0,0 ${arcPath(r, wedge)}`}
            fill={color}
            fillOpacity={active ? 0.22 : 0.12}
          />
          {[wedge.center - wedge.half, wedge.center + wedge.half].map((edge, ei) => {
            const [dx, dy] = dir(edge);
            return (
              <line
                key={ei}
                x1={0}
                y1={0}
                x2={r * dx}
                y2={r * dy}
                stroke={color}
                strokeWidth={active ? 1.8 : 1.2}
                strokeOpacity={active ? 0.95 : 0.7}
              />
            );
          })}
        </g>
      ))}
      <circle cx={0} cy={0} r={2.5} fill={color} />
    </g>
  );
}

/** 2D SVG board: ships as bases with a front-arc wedge, mapped from world mm (y-up) to screen (y-down). */
export const SvgBoard: BoardRenderer = ({
  view,
  activeId,
  highlightIds = [],
  preview,
  onPick,
  placing = false,
  invalidObstacleIds = [],
  onObstacleMove,
  onShipMove,
  arcShipId,
}) => {
  const ships = view.ships.filter((s) => s.hull > 0);
  const previewShip = preview ? ships.find((s) => s.id === preview.shipId) : undefined;
  const engageAttacker =
    view.phase === 'engagement' && activeId ? ships.find((s) => s.id === activeId) : undefined;
  const arcShip = arcShipId ? ships.find((s) => s.id === arcShipId) : engageAttacker;
  const { ref, viewBox, onMouseDown } = usePanZoom();
  const drag = useRef<{ id: string; kind: 'obstacle' | 'ship' } | null>(null);
  const dragging = placing || Boolean(onShipMove);

  const toWorld = (e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const m = ref.current?.getScreenCTM();
    if (!m) return null;
    return { x: (e.clientX - m.e) / m.a, y: -(e.clientY - m.f) / m.d };
  };
  const startDrag = (id: string, kind: 'obstacle' | 'ship') => (e: ReactPointerEvent) => {
    e.stopPropagation();
    drag.current = { id, kind };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const w = toWorld(e);
    if (!w) return;
    const x = Math.round(w.x);
    const y = Math.round(w.y);
    if (drag.current.kind === 'obstacle') onObstacleMove?.(drag.current.id, x, y);
    else onShipMove?.(drag.current.id, x, y);
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <svg
      ref={ref}
      className="board"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      onMouseDown={(e) => (drag.current ? undefined : onMouseDown(e))}
      onPointerMove={dragging ? onPointerMove : undefined}
      onPointerUp={dragging ? endDrag : undefined}
    >
      <Starfield />
      <ShipDefs />
      <rect x={-498} y={-498} width={996} height={996} rx={16} className="mat" />

      {view.obstacles.map((o) => (
        <circle
          key={o.id}
          cx={o.pos.x}
          cy={-o.pos.y}
          r={o.radius}
          className={`obstacle ${o.kind}${invalidObstacleIds.includes(o.id) ? ' invalid' : ''}${placing ? ' draggable' : ''}`}
          onPointerDown={placing ? startDrag(o.id, 'obstacle') : undefined}
        />
      ))}

      {arcShip && (
        <g transform={`translate(${arcShip.pos.x} ${-arcShip.pos.y}) rotate(${arcShip.pos.angle})`}>
          <CombatArc base={BASE_MM[arcShip.base]} wedges={arcWedges(arcShip)} color={colorFor(view, arcShip)} />
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

        const tokens = tokenCounts(s);
        const tokenSpan = (tokens.length - 1) * 12;
        const name = s.pilot || s.id.replace(/-/g, ' ');

        return (
          <g
            key={s.id}
            onClick={() => onPick?.(s.id)}
            onPointerDown={onShipMove ? startDrag(s.id, 'ship') : undefined}
            style={{ cursor: onShipMove ? 'grab' : onPick ? 'pointer' : 'default' }}
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
                wedges={arcWedges(s)}
              />
              {/* name on the rear edge, in the plate's frame (rotates with the base) */}
              <text
                x={0}
                y={w / 2 - 5}
                textAnchor="middle"
                textLength={w - 8}
                lengthAdjust="spacingAndGlyphs"
                className="shipLabel"
              >
                {name}
              </text>
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
  return { shipId, pos: applyManeuver(ship.pos, ship.dial, ship.base) };
}
