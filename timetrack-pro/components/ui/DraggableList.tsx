import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  View,
  type GestureResponderHandlers,
  type LayoutChangeEvent,
} from 'react-native';

export interface DragRenderInfo<T> {
  item: T;
  index: number;
  /** True while this row is the one being dragged. */
  dragging: boolean;
  /** Spread onto the grip the user drags by. */
  dragHandlers: GestureResponderHandlers;
}

interface DraggableListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  /** Called as the dragged row crosses a neighbour — reorder immediately. */
  onReorder: (from: number, to: number) => void;
  /** Holding the grip still, without dragging, fires this instead of a drag. */
  onLongPress?: (item: T, index: number) => void;
  /**
   * Fired as a drag starts and ends. The parent must use this to switch off
   * its ScrollView: a JS pan responder cannot outvote a native scroll view,
   * so without it the page scrolls under the finger while the row moves.
   */
  onDragActiveChange?: (active: boolean) => void;
  renderItem: (info: DragRenderInfo<T>) => React.ReactNode;
}

/** How long the grip must be held, and how far it may stray while held. */
const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 8;
/**
 * Extra travel demanded past a neighbour's midpoint before swapping. Without
 * it a row that lands exactly on the boundary swaps back and forth every
 * frame, which reads as flashing.
 */
const SWAP_HYSTERESIS = 6;

interface RowLayout {
  /** Offset within the list, used to derive the gap between rows. */
  y: number;
  /** The row's own height — its margin is not included. */
  h: number;
}

/**
 * A vertical list whose rows can be dragged by a grip to reorder.
 *
 * Rows are reordered live as the finger crosses a neighbour's midpoint, so the
 * parent's array is the single source of truth and nothing has to be committed
 * on release. The dragged row is translated by the gesture minus the distance
 * its own slot has already shifted, which keeps it pinned under the finger
 * while everything else settles into the new order.
 *
 * Only the grip claims the touch, so the surrounding ScrollView still scrolls
 * normally everywhere else on the row.
 */
export default function DraggableList<T>({
  data,
  keyExtractor,
  onReorder,
  onLongPress,
  onDragActiveChange,
  renderItem,
}: DraggableListProps<T>) {
  // Where each row sits and how tall it is, keyed by item — the drag needs to
  // know how far a neighbour is before it can decide to swap with it.
  const layouts = useRef<Record<string, RowLayout>>({});
  // The space between two rows. A row's measured height stops at its own edge,
  // so the card's margin has to be added back or every swap under-counts the
  // distance travelled and the dragged row drifts out from under the finger.
  const gap = useRef(0);
  // The working order during a gesture; re-derived from props every render.
  const orderRef = useRef<string[]>([]);
  orderRef.current = data.map(keyExtractor);

  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const setDragging = (key: string | null) => {
    setDraggingKey(key);
    onDragActiveChange?.(key !== null);
  };

  return (
    <View>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        return (
          <DraggableRow
            key={key}
            itemKey={key}
            index={index}
            layouts={layouts}
            gap={gap}
            orderRef={orderRef}
            onReorder={onReorder}
            onLongPress={onLongPress ? () => onLongPress(item, index) : undefined}
            dragging={draggingKey === key}
            onDragStart={() => setDragging(key)}
            onDragEnd={() => setDragging(null)}
            render={(dragHandlers, dragging) =>
              renderItem({ item, index, dragging, dragHandlers })
            }
          />
        );
      })}
    </View>
  );
}

interface DraggableRowProps {
  itemKey: string;
  index: number;
  layouts: React.MutableRefObject<Record<string, RowLayout>>;
  gap: React.MutableRefObject<number>;
  orderRef: React.MutableRefObject<string[]>;
  onReorder: (from: number, to: number) => void;
  onLongPress?: () => void;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  render: (
    dragHandlers: GestureResponderHandlers,
    dragging: boolean,
  ) => React.ReactNode;
}

function DraggableRow({
  itemKey,
  index,
  layouts,
  gap,
  orderRef,
  onReorder,
  onLongPress,
  dragging,
  onDragStart,
  onDragEnd,
  render,
}: DraggableRowProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  // The PanResponder is built once, so everything it reads goes through refs.
  const latest = useRef({ index, onReorder, onLongPress, onDragStart, onDragEnd });
  latest.current = { index, onReorder, onLongPress, onDragStart, onDragEnd };
  // Where the row currently sits, and how far its slot has moved so far.
  const slot = useRef(index);
  const shift = useRef(0);
  // A hold that never travels is a long press, not a drag. The timer decides
  // which one happened; once it fires, the gesture stops reordering.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldOpen = useRef(false);

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  useEffect(() => clearHold, []);

  /** How far this row's neighbour sits: its height plus the gap between them. */
  const pitchOf = (key: string) => {
    const l = layouts.current[key];
    return l ? l.h + gap.current : 0;
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        slot.current = latest.current.index;
        shift.current = 0;
        heldOpen.current = false;
        translateY.setValue(0);
        latest.current.onDragStart();
        if (latest.current.onLongPress) {
          holdTimer.current = setTimeout(() => {
            heldOpen.current = true;
            translateY.setValue(0);
            latest.current.onDragEnd();
            latest.current.onLongPress?.();
          }, LONG_PRESS_MS);
        }
      },
      onPanResponderMove: (_e, gesture) => {
        // Travelling far enough means this is a drag: cancel the pending hold.
        if (Math.abs(gesture.dy) > LONG_PRESS_SLOP) clearHold();
        if (heldOpen.current) return;
        const keys = orderRef.current;
        let at = slot.current;
        let moved = shift.current;

        // Past the next row's midpoint? Swap with it, and keep going in case
        // the finger travelled several rows in one frame.
        while (at < keys.length - 1) {
          const pitch = pitchOf(keys[at + 1]);
          if (pitch <= 0 || gesture.dy - moved <= pitch / 2 + SWAP_HYSTERESIS) break;
          latest.current.onReorder(at, at + 1);
          const [k] = keys.splice(at, 1);
          keys.splice(at + 1, 0, k);
          moved += pitch;
          at += 1;
        }
        while (at > 0) {
          const pitch = pitchOf(keys[at - 1]);
          if (pitch <= 0 || gesture.dy - moved >= -pitch / 2 - SWAP_HYSTERESIS) break;
          latest.current.onReorder(at, at - 1);
          const [k] = keys.splice(at, 1);
          keys.splice(at - 1, 0, k);
          moved -= pitch;
          at -= 1;
        }

        slot.current = at;
        shift.current = moved;
        translateY.setValue(gesture.dy - moved);
      },
      onPanResponderRelease: () => {
        clearHold();
        translateY.setValue(0);
        if (!heldOpen.current) latest.current.onDragEnd();
      },
      onPanResponderTerminate: () => {
        clearHold();
        translateY.setValue(0);
        if (!heldOpen.current) latest.current.onDragEnd();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    layouts.current[itemKey] = { y, h: height };
    // Measure the inter-row gap off the row above rather than hard-coding the
    // card's margin, so the list stays correct whatever spacing a card uses.
    const keys = orderRef.current;
    const i = keys.indexOf(itemKey);
    if (i > 0) {
      const prev = layouts.current[keys[i - 1]];
      if (prev) {
        const measured = y - (prev.y + prev.h);
        if (measured >= 0 && measured < 64) gap.current = measured;
      }
    }
  };

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        { transform: [{ translateY }] },
        dragging && { zIndex: 10, elevation: 10, opacity: 0.95 },
      ]}
    >
      {render(responder.panHandlers, dragging)}
    </Animated.View>
  );
}
