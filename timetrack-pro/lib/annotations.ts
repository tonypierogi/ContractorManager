/**
 * Marks drawn over a photo — circles, arrows and freehand scribble.
 *
 * Coordinates are normalised to 0..1 against the *image*, not the view that
 * happens to be showing it, so one stored drawing renders correctly over a
 * 96pt preview and a full-screen lightbox alike.
 */

export type AnnotationKind = 'path' | 'ellipse' | 'arrow';

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface ImageAnnotation {
  id: string;
  kind: AnnotationKind;
  color: string;
  /** Stroke thickness as a fraction of the image's width. */
  width: number;
  /**
   * 'path': every sampled point along the scribble.
   * 'ellipse': [corner, opposite corner] of the bounding box.
   * 'arrow': [tail, head].
   */
  points: AnnotationPoint[];
}

/** The pens offered by the annotator, brightest-first. */
export const ANNOTATION_COLORS = [
  '#f43f5e',
  '#facc15',
  '#00d4aa',
  '#38bdf8',
  '#ffffff',
] as const;

export const DEFAULT_ANNOTATION_COLOR = ANNOTATION_COLORS[0];

/** Fraction-of-width stroke sizes: readable on a phone, not a marker pen. */
export const ANNOTATION_WIDTHS = {
  thin: 0.006,
  medium: 0.012,
  thick: 0.022,
} as const;

export type AnnotationWidthName = keyof typeof ANNOTATION_WIDTHS;

/** Nothing below this reads as a line once it's scaled into a thumbnail. */
const MIN_STROKE_PX = 1.5;

/** Freehand points closer together than this add cost, not detail. */
const MIN_SAMPLE_DISTANCE = 0.004;

let counter = 0;

/** Ids only have to be unique within one drawing — no uuid dependency needed. */
export function newAnnotationId(): string {
  counter += 1;
  return `a${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Stroke thickness in points for a drawing rendered `boxWidth` points wide. */
export function strokePx(annotation: ImageAnnotation, boxWidth: number): number {
  return Math.max(MIN_STROKE_PX, annotation.width * boxWidth);
}

/**
 * Whether a freehand point is far enough from the last one to be worth
 * keeping. Called on every touch move, so the check stays cheap.
 */
export function shouldSamplePoint(
  previous: AnnotationPoint | undefined,
  next: AnnotationPoint,
): boolean {
  if (!previous) return true;
  return (
    Math.abs(next.x - previous.x) > MIN_SAMPLE_DISTANCE ||
    Math.abs(next.y - previous.y) > MIN_SAMPLE_DISTANCE
  );
}

/**
 * A stroke the user started but never really drew — a tap rather than a drag.
 * Dropping these keeps stray taps from littering the photo with dots.
 */
export function isEmptyAnnotation(annotation: ImageAnnotation): boolean {
  const { points, kind } = annotation;
  if (points.length < 2) return true;
  if (kind === 'path') return false;
  const [a, b] = [points[0], points[points.length - 1]];
  return Math.abs(a.x - b.x) < 0.02 && Math.abs(a.y - b.y) < 0.02;
}

/**
 * Parse whatever came back from the database. The column is free-form JSON and
 * predates nothing, but a hand-edited row (or an older client) shouldn't be
 * able to crash the list — anything unrecognised is dropped.
 */
export function parseAnnotations(value: unknown): ImageAnnotation[] {
  if (!Array.isArray(value)) return [];
  const parsed: ImageAnnotation[] = [];
  value.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const item = raw as Partial<ImageAnnotation>;
    const kind = item.kind;
    if (kind !== 'path' && kind !== 'ellipse' && kind !== 'arrow') return;
    if (!Array.isArray(item.points)) return;
    const points = item.points
      .filter(
        (p): p is AnnotationPoint =>
          !!p && typeof p.x === 'number' && typeof p.y === 'number',
      )
      .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
    if (points.length < 2) return;
    parsed.push({
      id: typeof item.id === 'string' ? item.id : newAnnotationId(),
      kind,
      color: typeof item.color === 'string' ? item.color : DEFAULT_ANNOTATION_COLOR,
      width:
        typeof item.width === 'number' && item.width > 0
          ? item.width
          : ANNOTATION_WIDTHS.medium,
      points,
    });
  });
  return parsed;
}

/** [] and null mean the same thing to the reader; store the cheaper one. */
export function serializeAnnotations(
  annotations: ImageAnnotation[],
): ImageAnnotation[] | null {
  return annotations.length ? annotations : null;
}

export function hasAnnotations(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}
