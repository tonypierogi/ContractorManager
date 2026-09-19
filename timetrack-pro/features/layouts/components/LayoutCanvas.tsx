import { memo, useCallback, useMemo, useRef } from 'react';
import {
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Colors, FontSize } from '@/constants/theme';
import PieceBody from '@/features/layouts/components/PieceBody';
import {
  DEFAULT_PIECE_COLOR,
  FULL_PLAN,
  planImage,
  type PlanRect,
  type PlanScale,
} from '@/features/layouts/geometry';
import type { FloorLayoutItem, FurniturePiece, PlanFloor } from '@/types/database';

interface LayoutCanvasProps {
  floor: PlanFloor;
  /** The floor plan's real size, fitted from its measurement lines. */
  scale: PlanScale;
  items: FloorLayoutItem[];
  pieces: Map<string, FurniturePiece>;
  /** Width available, in px. */
  maxWidth: number;
  /** Height available, in px. Omit to fit the width and let the height follow. */
  maxHeight?: number;
  /** Part of the plan to show, as fractions of the image. Defaults to all of it. */
  crop?: PlanRect;
  selectedId?: string | null;
  /** Tapping a piece selects it; tapping the plan passes null. */
  onSelect?: (itemId: string | null) => void;
  /**
   * Where a dragged piece's centre wants to go, as fractions of the plan.
   * Called on every move; the parent clamps it and writes it back through
   * `items`. Leave unset for a read-only plan.
   */
  onMove?: (itemId: string, x: number, y: number) => void;
  /** Fired as a drag starts and ends, so a parent ScrollView can stand down. */
  onDragActiveChange?: (active: boolean) => void;
  /** Thumbnail mode: no rulers, no grid, no labels, no touch. */
  compact?: boolean;
}

/** Space kept for the foot markings along the top and left edges. */
const RULER = 18;

/**
 * The floor plan drawn at its real size with the furniture on top.
 *
 * One number, px per inch, places everything. The plan image is stretched to
 * scale.widthIn x scale.depthIn at that rate — which also undoes any stretch
 * in the drawing itself — and every piece is its real size at the same rate,
 * so a 6′ table is always twice a 3′ one and the gaps between pieces are the
 * gaps the crew will pace out.
 *
 * Dragging uses a PanResponder per piece rather than a gesture library — the
 * same approach as components/ui/DraggableList — so it works identically in
 * the web build and on phones without a new native module.
 */
export default function LayoutCanvas({
  floor,
  scale,
  items,
  pieces,
  maxWidth,
  maxHeight,
  crop = FULL_PLAN,
  selectedId = null,
  onSelect,
  onMove,
  onDragActiveChange,
  compact = false,
}: LayoutCanvasProps) {
  const gutter = compact ? 0 : RULER;
  const windowWIn = crop.w * scale.widthIn;
  const windowHIn = crop.h * scale.depthIn;
  const k = Math.max(
    0.001,
    Math.min(
      (maxWidth - gutter) / windowWIn,
      maxHeight != null ? (maxHeight - gutter) / windowHIn : Infinity,
    ),
  );

  // The whole image at this scale, and where the crop puts its corner.
  const planW = scale.widthIn * k;
  const planH = scale.depthIn * k;
  const originX = gutter - crop.x * planW;
  const originY = gutter - crop.y * planH;
  const viewW = windowWIn * k;
  const viewH = windowHIn * k;

  // Grid over the plan: a faint line every foot when feet are far enough apart
  // to read, every 5′ otherwise; every 5′ a little stronger.
  const minorStepIn = 12 * k >= 8 ? 12 : 60;
  const grid = useMemo(() => {
    if (compact) return [];
    const lines: { key: string; style: ViewStyle }[] = [];
    const x0 = crop.x * scale.widthIn;
    const y0 = crop.y * scale.depthIn;
    for (let x = Math.ceil(x0 / minorStepIn) * minorStepIn; x < x0 + windowWIn; x += minorStepIn) {
      lines.push({
        key: `v${x}`,
        style: {
          left: (x - x0) * k,
          top: 0,
          bottom: 0,
          width: StyleSheet.hairlineWidth,
          backgroundColor: x % 60 === 0 ? GRID_MAJOR : GRID_MINOR,
        },
      });
    }
    for (let y = Math.ceil(y0 / minorStepIn) * minorStepIn; y < y0 + windowHIn; y += minorStepIn) {
      lines.push({
        key: `h${y}`,
        style: {
          top: (y - y0) * k,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: y % 60 === 0 ? GRID_MAJOR : GRID_MINOR,
        },
      });
    }
    return lines;
  }, [compact, crop, scale, k, minorStepIn, windowWIn, windowHIn]);

  // Foot marks every 5′, or every 10′ when 5′ marks would collide.
  const rulerStepIn = 60 * k >= 26 ? 60 : 120;
  const marks = (startIn: number, lengthIn: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(startIn / rulerStepIn) * rulerStepIn; v <= startIn + lengthIn; v += rulerStepIn) {
      out.push(v);
    }
    return out;
  };

  // In the browser, letting go of a drag also clicks the plan underneath,
  // which must not deselect the piece that was just moved.
  const ignoreTapsUntil = useRef(0);
  const handleDragActive = useCallback(
    (active: boolean) => {
      if (!active) ignoreTapsUntil.current = Date.now() + 350;
      onDragActiveChange?.(active);
    },
    [onDragActiveChange],
  );

  // The selected piece is drawn last so it sits above anything it overlaps.
  const ordered = useMemo(() => {
    if (!selectedId) return items;
    const selected = items.find((item) => item.id === selectedId);
    return selected ? [...items.filter((item) => item.id !== selectedId), selected] : items;
  }, [items, selectedId]);

  return (
    <Pressable
      onPress={
        onSelect
          ? () => {
              if (Date.now() >= ignoreTapsUntil.current) onSelect(null);
            }
          : undefined
      }
      disabled={compact || !onSelect}
      accessible={false}
      pointerEvents={compact ? 'none' : 'auto'}
      style={{ width: viewW + gutter, height: viewH + gutter }}
    >
      <View
        pointerEvents="none"
        style={[s.planWindow, { left: gutter, top: gutter, width: viewW, height: viewH }]}
      >
        <Image
          source={planImage(floor)}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            left: originX - gutter,
            top: originY - gutter,
            width: planW,
            height: planH,
            opacity: PLAN_OPACITY,
          }}
        />
        {grid.map((line) => (
          <View key={line.key} style={[s.gridLine, line.style]} />
        ))}
      </View>

      {!compact ? (
        <>
          {marks(crop.x * scale.widthIn, windowWIn).map((v) => (
            <Text
              key={`rx${v}`}
              style={[s.rulerText, { left: originX + v * k - 20, top: 0, width: 40 }]}
            >
              {v / 12}′
            </Text>
          ))}
          {marks(crop.y * scale.depthIn, windowHIn).map((v) =>
            v === 0 ? null : (
              <Text
                key={`ry${v}`}
                style={[s.rulerText, s.rulerTextLeft, { top: originY + v * k - 7, left: 0 }]}
              >
                {v / 12}′
              </Text>
            ),
          )}
        </>
      ) : null}

      <View
        style={[s.pieceLayer, { left: gutter, top: gutter, width: viewW, height: viewH }]}
        pointerEvents="box-none"
      >
        {ordered.map((item) => {
          const piece = pieces.get(item.piece_id);
          if (!piece) return null;
          return (
            <PlacedPiece
              key={item.id}
              item={item}
              piece={piece}
              k={k}
              planW={planW}
              planH={planH}
              offsetX={originX - gutter}
              offsetY={originY - gutter}
              selected={item.id === selectedId}
              compact={compact}
              onSelect={onSelect}
              onMove={onMove}
              onDragActiveChange={handleDragActive}
            />
          );
        })}
      </View>
    </Pressable>
  );
}

interface PlacedPieceProps {
  item: FloorLayoutItem;
  piece: FurniturePiece;
  /** px per inch. */
  k: number;
  /** The whole plan image's size in px, for turning fractions into px. */
  planW: number;
  planH: number;
  /** Where the plan's top-left corner sits in the piece layer (negative when cropped). */
  offsetX: number;
  offsetY: number;
  selected: boolean;
  compact: boolean;
  onSelect?: (itemId: string | null) => void;
  onMove?: (itemId: string, x: number, y: number) => void;
  onDragActiveChange: (active: boolean) => void;
}

/** Finger travel, in px, before a touch on a piece counts as a drag. */
const DRAG_SLOP = 3;

const PlacedPiece = memo(function PlacedPiece({
  item,
  piece,
  k,
  planW,
  planH,
  offsetX,
  offsetY,
  selected,
  compact,
  onSelect,
  onMove,
  onDragActiveChange,
}: PlacedPieceProps) {
  // The responder is built once; everything it reads lives in this ref so a
  // drag always works from the latest position, size and callbacks.
  const latest = useRef({ item, planW, planH, onSelect, onMove, onDragActiveChange });
  latest.current = { item, planW, planH, onSelect, onMove, onDragActiveChange };
  const drag = useRef({ startX: 0, startY: 0, moved: false });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!latest.current.onSelect,
        onMoveShouldSetPanResponder: () => !!latest.current.onSelect,
        // A plan inside a scroll view must not lose the piece mid-drag.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const { item: current, onSelect: select } = latest.current;
          drag.current = { startX: current.x, startY: current.y, moved: false };
          select?.(current.id);
          if (latest.current.onMove) latest.current.onDragActiveChange(true);
        },
        onPanResponderMove: (_e, g) => {
          const { item: current, planW: w, planH: h, onMove: move } = latest.current;
          if (!move) return;
          if (!drag.current.moved && Math.hypot(g.dx, g.dy) < DRAG_SLOP) return;
          drag.current.moved = true;
          move(current.id, drag.current.startX + g.dx / w, drag.current.startY + g.dy / h);
        },
        onPanResponderRelease: () => {
          if (latest.current.onMove) latest.current.onDragActiveChange(false);
        },
        onPanResponderTerminate: () => {
          if (latest.current.onMove) latest.current.onDragActiveChange(false);
        },
      }),
    [],
  );

  const w = piece.width_in * k;
  const h = piece.depth_in * k;
  const isL = piece.shape === 'l' && !!piece.arm_in;
  const arm = isL ? piece.arm_in! * k : 0;
  const color = piece.color || DEFAULT_PIECE_COLOR;
  const text = item.label || piece.name;
  // An L's label sits in its top arm; everything else uses the whole piece.
  const textW = w;
  const textH = isL ? arm : h;
  const fontSize = Math.max(8, Math.min(FontSize.xs, Math.min(textW, textH) * 0.4));
  // Only draw words that fit: on one line, or on two when the piece is tall
  // enough. A half-word like "Coc…" on a cocktail table reads as noise.
  const lineWidth = text.length * fontSize * 0.56;
  const lines = textH >= fontSize * 2.6 ? 2 : 1;
  const showText = !compact && textH >= 12 && lineWidth <= (textW - 6) * lines;
  // Keep the words readable: past a quarter turn, turn them the right way
  // up, and undo a mirrored piece's mirror.
  const upsideDown = item.rotation > 90 && item.rotation <= 270;
  const textTransform = [
    ...(upsideDown ? [{ rotate: '180deg' }] : []),
    ...(item.flip ? [{ scaleX: -1 }] : []),
  ];

  return (
    <View
      {...(compact ? {} : responder.panHandlers)}
      accessibilityRole={compact ? undefined : 'button'}
      accessibilityLabel={compact ? undefined : text}
      style={[
        s.piece,
        webDragStyle(!!onMove && !compact),
        {
          left: offsetX + item.x * planW - w / 2,
          top: offsetY + item.y * planH - h / 2,
          width: w,
          height: h,
          // Mirror first, then turn — so a flipped piece rotates the way it looks.
          transform: [{ rotate: `${item.rotation}deg` }, ...(item.flip ? [{ scaleX: -1 }] : [])],
        },
        // The lift shadow follows the container's box, which for an L would
        // outline the empty inside corner too — so an L goes without.
        selected && !isL && s.pieceSelected,
      ]}
    >
      <PieceBody
        shape={piece.shape}
        width={w}
        height={h}
        arm={arm}
        // Solid, with a dark edge, so pieces stand off the grey plan behind
        // them — and an L's two arms join without a seam.
        fill={color}
        borderColor={selected ? Colors.text : PIECE_EDGE}
        borderWidth={selected ? 2 : 1}
      />
      {showText ? (
        <View pointerEvents="none" style={[s.textBox, { height: textH }]}>
          <Text
            numberOfLines={lines}
            style={[
              s.pieceText,
              { fontSize, lineHeight: fontSize * 1.15, maxWidth: textW - 4 },
              textTransform.length ? { transform: textTransform } : null,
            ]}
          >
            {text}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

/** Grab cursor and no text selection while dragging, in the browser build. */
function webDragStyle(draggable: boolean): ViewStyle | null {
  if (Platform.OS !== 'web') return null;
  return {
    cursor: draggable ? 'grab' : 'pointer',
    userSelect: 'none',
    touchAction: 'none',
  } as unknown as ViewStyle;
}

const GRID_MINOR = 'rgba(0, 212, 170, 0.07)';
const GRID_MAJOR = 'rgba(0, 212, 170, 0.18)';
/** The plan sits behind the furniture as reference, not as the subject. */
const PLAN_OPACITY = 0.6;
/** Outline on every unselected piece, so a grey chair still reads on a grey plan. */
const PIECE_EDGE = 'rgba(10, 15, 26, 0.85)';

const s = StyleSheet.create({
  planWindow: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: Colors.bgSecondary,
  },
  pieceLayer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
  },
  rulerText: {
    position: 'absolute',
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rulerTextLeft: {
    width: RULER - 2,
    textAlign: 'right',
  },
  piece: {
    position: 'absolute',
  },
  textBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  pieceText: {
    color: '#0a0f1a',
    fontWeight: '700',
    textAlign: 'center',
  },
});
