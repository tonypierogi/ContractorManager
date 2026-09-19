import type { ImageSourcePropType } from 'react-native';
import {
  FLOOR_PLAN_ASPECT,
  FLOOR_PLAN_DEFAULT,
  ZONE_OVERLAYS,
  getLocationLabel,
} from '@/features/locations/zones';
import type {
  FloorLayoutItem,
  FloorPlanMeasurement,
  FurniturePiece,
  PlanFloor,
} from '@/types/database';

/** A box on a floor-plan image, as fractions (0-1) of its width and height. */
export interface PlanRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_PLAN: PlanRect = { x: 0, y: 0, w: 1, h: 1 };

export const PLAN_FLOORS: { key: PlanFloor; label: string }[] = [
  { key: 'upstairs', label: 'Upstairs' },
  { key: 'downstairs', label: 'Downstairs' },
];

export function floorLabel(floor: PlanFloor): string {
  return PLAN_FLOORS.find((f) => f.key === floor)?.label ?? floor;
}

export function planImage(floor: PlanFloor): ImageSourcePropType {
  return FLOOR_PLAN_DEFAULT[floor];
}

/** Width / height of the floor's plan image. */
export function planAspect(floor: PlanFloor): number {
  return FLOOR_PLAN_ASPECT[floor];
}

/** "Big Room · Upstairs", or just "Upstairs" for a layout with no room. */
export function layoutPlace(layout: { floor: PlanFloor; zone_id: string | null }): string {
  const floor = floorLabel(layout.floor);
  return layout.zone_id ? `${getLocationLabel(layout.zone_id)} · ${floor}` : floor;
}

/**
 * Where a room sits on its floor plan (the tap targets in
 * features/locations/zones.ts), or null for rooms that aren't outlined on
 * the image. Used to open a layout scrolled to its room.
 */
export function zoneOutline(zoneId: string | null): { floor: PlanFloor; rect: PlanRect } | null {
  if (!zoneId) return null;
  for (const floor of ['upstairs', 'downstairs'] as PlanFloor[]) {
    const overlay = ZONE_OVERLAYS[floor].find((o) => o.id === zoneId);
    if (overlay) {
      return {
        floor,
        rect: {
          x: overlay.left / 100,
          y: overlay.top / 100,
          w: Math.min(overlay.width / 100, 1 - overlay.left / 100),
          h: Math.min(overlay.height / 100, 1 - overlay.top / 100),
        },
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scale: from measurement lines to the plan's real size
// ---------------------------------------------------------------------------

type LineEnds = Pick<FloorPlanMeasurement, 'x1' | 'y1' | 'x2' | 'y2'>;
type MeasuredLine = LineEnds & { length_in: number };

/** A floor plan's real size, fitted from its measurement lines. */
export interface PlanScale {
  /** Real distance across the whole image, left edge to right edge. */
  widthIn: number;
  /** Real distance down the whole image, top edge to bottom edge. */
  depthIn: number;
  /**
   * 'both': lines run both ways, so width and height were fitted separately
   * and a plan drawn slightly stretched still measures true.
   * 'uniform': lines only run one way, so the image is assumed unstretched.
   */
  fit: 'both' | 'uniform';
  lineCount: number;
}

/**
 * Fit the plan's real size to every line on it at once.
 *
 * A line from (x1, y1) to (x2, y2), in fractions of the image, is
 *   L² = (Δx · W)² + (Δy · H)²
 * long, where W x H is the image's real size. That's linear in W² and H²,
 * so the best W and H for all the lines together is a 2x2 least-squares
 * solve. It only works when lines run both ways (a set of horizontal lines
 * says nothing about height), so otherwise the image's own proportions are
 * trusted and only one scale is fitted.
 */
export function fitPlanScale(floor: PlanFloor, lines: MeasuredLine[]): PlanScale | null {
  const aspect = planAspect(floor);
  const valid = lines.filter((l) => l.length_in > 0 && (l.x1 !== l.x2 || l.y1 !== l.y2));
  if (!valid.length) return null;

  const rows = valid.map((l) => ({
    p: (l.x2 - l.x1) ** 2,
    q: (l.y2 - l.y1) ** 2,
    t: l.length_in ** 2,
  }));

  // Direction on the image as drawn (fractions of height for both axes).
  const runs = valid.map((l) => ({
    across: Math.abs(l.x2 - l.x1) * aspect,
    down: Math.abs(l.y2 - l.y1),
  }));
  const TAN_30 = 0.577;
  const hasAcross = runs.some((r) => r.down <= r.across * TAN_30);
  const hasDown = runs.some((r) => r.across <= r.down * TAN_30);

  if (valid.length >= 2 && hasAcross && hasDown) {
    let spp = 0, sqq = 0, spq = 0, spt = 0, sqt = 0;
    rows.forEach(({ p, q, t }) => {
      spp += p * p;
      sqq += q * q;
      spq += p * q;
      spt += p * t;
      sqt += q * t;
    });
    const det = spp * sqq - spq * spq;
    if (det > 1e-9 * spp * sqq) {
      const a = (spt * sqq - sqt * spq) / det;
      const b = (sqt * spp - spt * spq) / det;
      if (a > 0 && b > 0) {
        return { widthIn: Math.sqrt(a), depthIn: Math.sqrt(b), fit: 'both', lineCount: valid.length };
      }
    }
  }

  // Unstretched image: H = W / aspect, so L² = W² (Δx² + Δy² / aspect²).
  let skt = 0, skk = 0;
  rows.forEach(({ p, q, t }) => {
    const k = p + q / (aspect * aspect);
    skt += k * t;
    skk += k * k;
  });
  if (skk <= 0 || skt <= 0) return null;
  const width = Math.sqrt(skt / skk);
  return { widthIn: width, depthIn: width / aspect, fit: 'uniform', lineCount: valid.length };
}

/** How long a line on the plan is at a given scale — to check it against its tape measure. */
export function lineLengthAt(scale: PlanScale, line: LineEnds): number {
  return Math.hypot((line.x2 - line.x1) * scale.widthIn, (line.y2 - line.y1) * scale.depthIn);
}

/** Default fill for a piece with no colour set. */
export const DEFAULT_PIECE_COLOR = '#6b8afd';

/** Swatches offered in the furniture editor — distinct on the dark plan. */
export const PIECE_COLORS = [
  '#6b8afd', // blue
  '#00d4aa', // app accent
  '#f59e0b', // amber
  '#f472b6', // pink
  '#a78bfa', // violet
  '#94a3b8', // slate
  '#c08457', // wood
];

/** Rotation step for the rotate buttons. */
export const ROTATE_STEP = 15;

/**
 * 72 -> 6′, 30 -> 2′ 6″, 8 -> 8″. Primes, not apostrophes, so "6′ 0″"
 * doesn't read like a quote.
 */
export function formatInches(total: number): string {
  const inches = Math.round(total);
  const feet = Math.floor(inches / 12);
  const rest = inches % 12;
  if (feet === 0) return `${rest}″`;
  if (rest === 0) return `${feet}′`;
  return `${feet}′ ${rest}″`;
}

/** "40′ × 30′" — width by depth, for rooms. */
export function formatSize(widthIn: number, depthIn: number): string {
  return `${formatInches(widthIn)} × ${formatInches(depthIn)}`;
}

/**
 * One furniture dimension the way it's sold: short sides in inches (a 30″
 * deep table, an 18″ chair), long ones in feet (a 6′ table).
 */
function formatFurnitureInches(total: number): string {
  return total < 48 ? `${Math.round(total)}″` : formatInches(total);
}

/** A piece's description as the crew would say it: "60″ round", "6′ × 30″". */
export function describePiece(
  piece: Pick<FurniturePiece, 'shape' | 'width_in' | 'depth_in'> & { arm_in?: number | null },
): string {
  // Round tables go by diameter in inches at every size: a 60″, a 72″.
  if (piece.shape === 'round' && piece.width_in === piece.depth_in) {
    return `${piece.width_in}″ round`;
  }
  const size = `${formatFurnitureInches(piece.width_in)} × ${formatFurnitureInches(piece.depth_in)}`;
  if (piece.shape === 'l') {
    return piece.arm_in ? `${size} L, ${formatFurnitureInches(piece.arm_in)} deep` : `${size} L`;
  }
  return piece.shape === 'round' ? `${size} oval` : size;
}

/** Normalise any angle into 0-359. */
export function normalizeRotation(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

/**
 * The axis-aligned box a rotated piece occupies — what has to stay inside the
 * room when it's dragged. For a round piece the ellipse's own bounds are used.
 */
export function rotatedExtents(
  widthIn: number,
  depthIn: number,
  rotation: number,
  shape: FurniturePiece['shape'] = 'rect',
): { halfW: number; halfH: number } {
  const rad = (rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  const a = widthIn / 2;
  const b = depthIn / 2;
  if (shape === 'round') {
    return {
      halfW: Math.sqrt(a * a * c * c + b * b * s * s),
      halfH: Math.sqrt(a * a * s * s + b * b * c * c),
    };
  }
  return { halfW: a * c + b * s, halfH: a * s + b * c };
}

/**
 * Keep a piece's centre where the whole piece stays inside the room. A piece
 * bigger than the room is centred on that axis rather than pinned to a wall.
 */
export function clampToRoom(
  x: number,
  y: number,
  piece: Pick<FurniturePiece, 'shape' | 'width_in' | 'depth_in'>,
  rotation: number,
  roomWidthIn: number,
  roomDepthIn: number,
): { x: number; y: number } {
  const { halfW, halfH } = rotatedExtents(piece.width_in, piece.depth_in, rotation, piece.shape);
  const clampAxis = (v: number, half: number, size: number) =>
    half * 2 >= size ? size / 2 : Math.min(Math.max(v, half), size - half);
  return {
    x: Math.round(clampAxis(x, halfW, roomWidthIn)),
    y: Math.round(clampAxis(y, halfH, roomDepthIn)),
  };
}

/** A new placement id. Only has to be unique within its layout. */
export function newItemId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface PieceCount {
  piece: FurniturePiece;
  placed: number;
  /** True when we own a known number and the layout uses more. */
  over: boolean;
}

/**
 * How many of each piece a layout uses, in library order, with anything over
 * what we own flagged. Placements whose piece was deleted are left out.
 */
export function countPieces(
  items: FloorLayoutItem[],
  pieces: FurniturePiece[],
): PieceCount[] {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item.piece_id, (counts.get(item.piece_id) ?? 0) + 1));
  return pieces
    .filter((piece) => counts.has(piece.id))
    .map((piece) => {
      const placed = counts.get(piece.id) ?? 0;
      return { piece, placed, over: piece.quantity != null && placed > piece.quantity };
    });
}

/** "12 pieces" / "1 piece". */
export function pieceCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'piece' : 'pieces'}`;
}
