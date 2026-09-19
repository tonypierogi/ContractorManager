import { memo, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { Colors, FontSize } from '@/constants/theme';
import { formatInches, planAspect, planImage } from '@/features/layouts/geometry';
import type { PlanFloor } from '@/types/database';

/** One measurement line being edited. length_in is null until typed. */
export interface LineDraft {
  /** Real id, or a temporary 'new-…' one until the first save. */
  id: string;
  floor: PlanFloor;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length_in: number | null;
}

type Ends = Pick<LineDraft, 'x1' | 'y1' | 'x2' | 'y2'>;

interface Props {
  floor: PlanFloor;
  lines: LineDraft[];
  /** Rendered width of the plan, in px; its height follows the image. */
  width: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** A line was drawn by dragging on empty plan. */
  onDraw: (ends: Ends) => void;
  onChangeEnds: (id: string, ends: Ends) => void;
  /** Fired as a drag starts and ends so a parent ScrollView can stand down. */
  onDragActiveChange?: (active: boolean) => void;
}

/** Travel before a press on the plan counts as drawing rather than a tap. */
const DRAW_SLOP = 6;
/** Lines within this many degrees of level or plumb snap straight. */
const SNAP_DEGREES = 4;
const TAN_SNAP = Math.tan((SNAP_DEGREES * Math.PI) / 180);

/**
 * The whole floor-plan image with its measurement lines. Drag across empty
 * plan to draw a new line; drag a line to move it; drag the selected line's
 * ends to adjust it. Lines snap level or plumb when they're nearly there,
 * since what gets measured is almost always a wall.
 */
export default function PlanLinesCanvas({
  floor,
  lines,
  width,
  selectedId,
  onSelect,
  onDraw,
  onChangeEnds,
  onDragActiveChange,
}: Props) {
  const height = width / planAspect(floor);
  const [sketch, setSketch] = useState<Ends | null>(null);

  const latest = useRef({ width, height, onSelect, onDraw, onDragActiveChange });
  latest.current = { width, height, onSelect, onDraw, onDragActiveChange };
  const start = useRef({ x: 0, y: 0 });
  const sketchRef = useRef<Ends | null>(null);

  // Drawing happens on the plan itself; lines and handles are children with
  // their own responders, so a press on them never reaches this one.
  const drawResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          start.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
          sketchRef.current = null;
        },
        onPanResponderMove: (_e, g) => {
          const { width: w, height: h } = latest.current;
          if (!sketchRef.current && Math.hypot(g.dx, g.dy) < DRAW_SLOP) return;
          if (!sketchRef.current) latest.current.onDragActiveChange?.(true);
          const ends = straighten(
            { x1: start.current.x, y1: start.current.y, x2: start.current.x + g.dx, y2: start.current.y + g.dy },
            'end',
          );
          const next = toFractions(ends, w, h);
          sketchRef.current = next;
          setSketch(next);
        },
        onPanResponderRelease: () => {
          const drawn = sketchRef.current;
          sketchRef.current = null;
          setSketch(null);
          if (drawn) {
            latest.current.onDragActiveChange?.(false);
            latest.current.onDraw(drawn);
          } else {
            latest.current.onSelect(null);
          }
        },
        onPanResponderTerminate: () => {
          if (sketchRef.current) latest.current.onDragActiveChange?.(false);
          sketchRef.current = null;
          setSketch(null);
        },
      }),
    [],
  );

  // Selected line on top, so its handles are never under a neighbour.
  const ordered = useMemo(() => {
    const selected = lines.find((l) => l.id === selectedId);
    return selected ? [...lines.filter((l) => l.id !== selectedId), selected] : lines;
  }, [lines, selectedId]);

  return (
    <View
      {...drawResponder.panHandlers}
      style={[s.plan, webCursor('crosshair'), { width, height }]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={planImage(floor)} resizeMode="stretch" style={{ width, height }} />
      </View>
      {ordered.map((line) => (
        <MeasureLine
          key={line.id}
          line={line}
          planW={width}
          planH={height}
          selected={line.id === selectedId}
          onSelect={onSelect}
          onChangeEnds={onChangeEnds}
          onDragActiveChange={onDragActiveChange}
        />
      ))}
      {sketch ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Segment ends={sketch} planW={width} planH={height} color={Colors.accent} thickness={3} />
        </View>
      ) : null}
    </View>
  );
}

interface MeasureLineProps {
  line: LineDraft;
  planW: number;
  planH: number;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onChangeEnds: (id: string, ends: Ends) => void;
  onDragActiveChange?: (active: boolean) => void;
}

type LineDrag = 'move' | 'start' | 'end';

/** How big an end handle is drawn, and the touch area around it. */
const HANDLE = 14;
const HANDLE_HIT = 36;
/** Touch area either side of a line, so a 3px stroke is still easy to grab. */
const LINE_HIT = 22;

const MeasureLine = memo(function MeasureLine({
  line,
  planW,
  planH,
  selected,
  onSelect,
  onChangeEnds,
  onDragActiveChange,
}: MeasureLineProps) {
  const latest = useRef({ line, planW, planH, onSelect, onChangeEnds, onDragActiveChange });
  latest.current = { line, planW, planH, onSelect, onChangeEnds, onDragActiveChange };
  const startEnds = useRef<Ends>(line);

  const responders = useMemo(() => {
    const make = (mode: LineDrag) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const { line: current } = latest.current;
          startEnds.current = { x1: current.x1, y1: current.y1, x2: current.x2, y2: current.y2 };
          latest.current.onSelect(current.id);
          latest.current.onDragActiveChange?.(true);
        },
        onPanResponderMove: (_e, g) => {
          const { line: current, planW: w, planH: h } = latest.current;
          const px = toPixels(startEnds.current, w, h);
          let next: Ends;
          if (mode === 'move') {
            // Keep the whole line on the plan while sliding it.
            const minX = Math.min(px.x1, px.x2);
            const maxX = Math.max(px.x1, px.x2);
            const minY = Math.min(px.y1, px.y2);
            const maxY = Math.max(px.y1, px.y2);
            const dx = Math.min(Math.max(g.dx, -minX), w - maxX);
            const dy = Math.min(Math.max(g.dy, -minY), h - maxY);
            next = { x1: px.x1 + dx, y1: px.y1 + dy, x2: px.x2 + dx, y2: px.y2 + dy };
          } else if (mode === 'start') {
            next = straighten({ ...px, x1: px.x1 + g.dx, y1: px.y1 + g.dy }, 'start');
          } else {
            next = straighten({ ...px, x2: px.x2 + g.dx, y2: px.y2 + g.dy }, 'end');
          }
          latest.current.onChangeEnds(current.id, toFractions(next, w, h));
        },
        onPanResponderRelease: () => latest.current.onDragActiveChange?.(false),
        onPanResponderTerminate: () => latest.current.onDragActiveChange?.(false),
      });
    return { move: make('move'), start: make('start'), end: make('end') };
  }, []);

  const px = toPixels(line, planW, planH);
  const length = Math.hypot(px.x2 - px.x1, px.y2 - px.y1);
  const angle = Math.atan2(px.y2 - px.y1, px.x2 - px.x1);
  const midX = (px.x1 + px.x2) / 2;
  const midY = (px.y1 + px.y2) / 2;
  const color = selected ? Colors.accent : line.length_in ? LINE_COLOR : Colors.warning;

  return (
    <>
      {/* The grab area: a wide invisible band along the line. */}
      <View
        {...responders.move.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={line.label || 'Measurement line'}
        style={[
          s.band,
          webCursor(selected ? 'move' : 'pointer'),
          {
            left: midX - length / 2,
            top: midY - LINE_HIT / 2,
            width: Math.max(length, 1),
            height: LINE_HIT,
            transform: [{ rotate: `${angle}rad` }],
          },
        ]}
      >
        <View style={[s.stroke, { backgroundColor: color, height: selected ? 3 : 2 }]} />
      </View>

      {/* End ticks, or draggable handles on the selected line. */}
      {(['start', 'end'] as const).map((end) => {
        const x = end === 'start' ? px.x1 : px.x2;
        const y = end === 'start' ? px.y1 : px.y2;
        return selected ? (
          <View
            key={end}
            {...responders[end].panHandlers}
            accessibilityLabel={`Move the ${end} of the line`}
            style={[s.handleHit, webCursor('grab'), { left: x - HANDLE_HIT / 2, top: y - HANDLE_HIT / 2 }]}
          >
            <View style={s.handle} />
          </View>
        ) : (
          <View
            key={end}
            pointerEvents="none"
            style={[s.tick, { left: x - 3, top: y - 3, backgroundColor: color }]}
          />
        );
      })}

      {/* The length, level at the middle of the line. */}
      <View pointerEvents="none" style={[s.tagWrap, { left: midX - 60, top: midY - 11 }]}>
        <View style={[s.tag, selected && s.tagSelected, !line.length_in && s.tagMissing]}>
          <Text style={[s.tagText, !line.length_in && s.tagTextMissing]} numberOfLines={1}>
            {line.length_in ? formatInches(line.length_in) : 'Set length'}
          </Text>
        </View>
      </View>
    </>
  );
});

/** A static segment, for the line being sketched. */
function Segment({
  ends,
  planW,
  planH,
  color,
  thickness,
}: {
  ends: Ends;
  planW: number;
  planH: number;
  color: string;
  thickness: number;
}) {
  const px = toPixels(ends, planW, planH);
  const length = Math.hypot(px.x2 - px.x1, px.y2 - px.y1);
  const angle = Math.atan2(px.y2 - px.y1, px.x2 - px.x1);
  return (
    <View
      style={{
        position: 'absolute',
        left: (px.x1 + px.x2) / 2 - length / 2,
        top: (px.y1 + px.y2) / 2 - thickness / 2,
        width: length,
        height: thickness,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

function toPixels(ends: Ends, w: number, h: number): Ends {
  return { x1: ends.x1 * w, y1: ends.y1 * h, x2: ends.x2 * w, y2: ends.y2 * h };
}

function toFractions(ends: Ends, w: number, h: number): Ends {
  const cx = (v: number) => Math.min(1, Math.max(0, v / w));
  const cy = (v: number) => Math.min(1, Math.max(0, v / h));
  return { x1: cx(ends.x1), y1: cy(ends.y1), x2: cx(ends.x2), y2: cy(ends.y2) };
}

/**
 * Snap a nearly-level or nearly-plumb line (in px) exactly straight by moving
 * the end being dragged; the other end stays where it is.
 */
function straighten(ends: Ends, moving: 'start' | 'end'): Ends {
  const dx = ends.x2 - ends.x1;
  const dy = ends.y2 - ends.y1;
  const level = Math.abs(dy) <= Math.abs(dx) * TAN_SNAP;
  const plumb = Math.abs(dx) <= Math.abs(dy) * TAN_SNAP;
  if (!level && !plumb) return ends;
  if (moving === 'end') {
    return level ? { ...ends, y2: ends.y1 } : { ...ends, x2: ends.x1 };
  }
  return level ? { ...ends, y1: ends.y2 } : { ...ends, x1: ends.x2 };
}

function webCursor(cursor: string): ViewStyle | null {
  if (Platform.OS !== 'web') return null;
  return { cursor, userSelect: 'none', touchAction: 'none' } as unknown as ViewStyle;
}

/** Measured lines read as dimension lines: strong, but not the accent. */
const LINE_COLOR = '#f472b6';

const s = StyleSheet.create({
  plan: {
    backgroundColor: Colors.bgSecondary,
  },
  band: {
    position: 'absolute',
    justifyContent: 'center',
  },
  stroke: {
    width: '100%',
    borderRadius: 2,
  },
  tick: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  handleHit: {
    position: 'absolute',
    width: HANDLE_HIT,
    height: HANDLE_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  tagWrap: {
    position: 'absolute',
    width: 120,
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(10, 15, 26, 0.85)',
    borderWidth: 1,
    borderColor: LINE_COLOR,
  },
  tagSelected: {
    borderColor: Colors.accent,
  },
  tagMissing: {
    borderColor: Colors.warning,
  },
  tagText: {
    fontSize: FontSize.xxs,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  tagTextMissing: {
    color: Colors.warning,
  },
});
