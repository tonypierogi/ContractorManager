import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  /** True while this row is being dragged, or travels with the block that is. */
  dragging: boolean;
  /** Spread onto the grip the user drags by. */
  dragHandlers: GestureResponderHandlers;
}

interface DraggableListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  /** Called as the dragged row crosses a neighbour — reorder immediately. */
  onReorder: (from: number, to: number) => void;
  /**
   * How many rows travel together when the row at `index` is picked up whole —
   * a section plus the tasks beneath it. 1 (the default) means the row moves
   * alone. The sizes must tile the list: walking them from index 0 has to land
   * on every row exactly once.
   */
  blockSize?: (index: number) => number;
  /**
   * Move the `count` rows starting at `from` as one. `to` is the insertion
   * index in the array *after* those rows have been removed.
   */
  onMoveBlock?: (from: number, count: number, to: number) => void;
  /**
   * Holding the grip still, without dragging, fires this instead of a drag —
   * except on a row that can be picked up as a block, where holding starts the
   * block drag instead.
   */
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

/** A swap that has been asked for but has not come back from the parent yet. */
interface PendingSwap {
  /** How many slots the dragged row moved, signed. */
  rows: number;
  /** How far that carried it, signed, in pixels. */
  dist: number;
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
 * That subtraction is deliberately *late*: it is applied in the layout pass
 * that renders the new order, not at the moment the swap is requested. Doing
 * it early moved the row back a slot while the list still showed the old
 * order, which read as the row flashing home and back again.
 *
 * Holding the grip of a row the parent marks as a block leader (`blockSize`)
 * picks up the whole block — a section and its tasks — and drags it as a unit.
 *
 * Only the grip claims the touch, so the surrounding ScrollView still scrolls
 * normally everywhere else on the row.
 */
export default function DraggableList<T>({
  data,
  keyExtractor,
  onReorder,
  blockSize,
  onMoveBlock,
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
  // Every row's translation, so a block leader can carry its members along.
  const values = useRef<Record<string, Animated.Value>>({});

  // The rows currently lifted: one for a plain drag, the whole block for a
  // block drag.
  const [dragKeys, setDragKeys] = useState<string[]>([]);

  const setDragging = (keys: string[]) => {
    setDragKeys(keys);
    onDragActiveChange?.(keys.length > 0);
  };

  /**
   * Cut the current order into the blocks that move as units. Taken once, as a
   * block drag begins: a block drag only ever reorders whole blocks, so the
   * grouping itself cannot change under the gesture.
   */
  const buildBlocks = () => {
    const keys = orderRef.current;
    const blocks: string[][] = [];
    for (let i = 0; i < keys.length; ) {
      const n = Math.max(1, Math.min(blockSize?.(i) ?? 1, keys.length - i));
      blocks.push(keys.slice(i, i + n));
      i += n;
    }
    return blocks;
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
            values={values}
            onReorder={onReorder}
            onMoveBlock={onMoveBlock}
            buildBlocks={buildBlocks}
            canBlock={!!onMoveBlock && (blockSize?.(index) ?? 1) > 1}
            onLongPress={onLongPress ? () => onLongPress(item, index) : undefined}
            dragging={dragKeys.includes(key)}
            onDragStart={setDragging}
            onDragEnd={() => setDragging([])}
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
  values: React.MutableRefObject<Record<string, Animated.Value>>;
  onReorder: (from: number, to: number) => void;
  onMoveBlock?: (from: number, count: number, to: number) => void;
  buildBlocks: () => string[][];
  canBlock: boolean;
  onLongPress?: () => void;
  dragging: boolean;
  onDragStart: (keys: string[]) => void;
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
  values,
  onReorder,
  onMoveBlock,
  buildBlocks,
  canBlock,
  onLongPress,
  dragging,
  onDragStart,
  onDragEnd,
  render,
}: DraggableRowProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  // The PanResponder is built once, so everything it reads goes through refs.
  const latest = useRef({
    index,
    onReorder,
    onMoveBlock,
    buildBlocks,
    canBlock,
    onLongPress,
    onDragStart,
    onDragEnd,
  });
  latest.current = {
    index,
    onReorder,
    onMoveBlock,
    buildBlocks,
    canBlock,
    onLongPress,
    onDragStart,
    onDragEnd,
  };

  // A block leader drives its members' translations too, so every row hands
  // its animated value to the list.
  useEffect(() => {
    values.current[itemKey] = translateY;
    return () => {
      delete values.current[itemKey];
    };
  }, [itemKey, translateY, values]);

  // Where the row sits logically, and how far its slot has moved so far. The
  // logical shift leads the visible one: `applied` only catches up once the
  // parent has actually re-rendered in the new order.
  const slot = useRef(index);
  const shift = useRef(0);
  const applied = useRef(0);
  const pending = useRef<PendingSwap[]>([]);
  const committedIndex = useRef(index);
  const lastDy = useRef(0);
  // True between grip-down and the last pending swap landing — only the row
  // being dragged may touch translations.
  const active = useRef(false);
  const released = useRef(false);
  // Set once a hold picks up a whole block: its rows, and where it now sits.
  const block = useRef<{ blocks: string[][]; at: number } | null>(null);
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

  /** The rows moving with this gesture: just this one, or the whole block. */
  const movingKeys = () => block.current?.blocks[block.current.at] ?? [itemKey];

  const applyTranslate = (value: number) => {
    for (const key of movingKeys()) values.current[key]?.setValue(value);
  };

  const settle = () => {
    applyTranslate(0);
    block.current = null;
    active.current = false;
  };

  /** How far this row's neighbour sits: its height plus the gap between them. */
  const pitchOf = (key: string) => {
    const l = layouts.current[key];
    return l ? l.h + gap.current : 0;
  };

  const blockPitch = (keys: string[]) =>
    keys.reduce((sum, key) => sum + pitchOf(key), 0);

  const flatStart = (blocks: string[][], at: number) =>
    blocks.slice(0, at).reduce((sum, b) => sum + b.length, 0);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        slot.current = latest.current.index;
        committedIndex.current = latest.current.index;
        shift.current = 0;
        applied.current = 0;
        lastDy.current = 0;
        pending.current = [];
        block.current = null;
        heldOpen.current = false;
        released.current = false;
        active.current = true;
        translateY.setValue(0);
        latest.current.onDragStart([itemKey]);
        // A section picks the whole block up on a hold; anything else offers
        // the parent's long-press action instead.
        if (latest.current.canBlock) {
          holdTimer.current = setTimeout(() => {
            holdTimer.current = null;
            const blocks = latest.current.buildBlocks();
            const at = blocks.findIndex((b) => b[0] === itemKey);
            if (at < 0) return;
            block.current = { blocks, at };
            latest.current.onDragStart(blocks[at]);
          }, LONG_PRESS_MS);
        } else if (latest.current.onLongPress) {
          holdTimer.current = setTimeout(() => {
            holdTimer.current = null;
            heldOpen.current = true;
            settle();
            latest.current.onDragEnd();
            latest.current.onLongPress?.();
          }, LONG_PRESS_MS);
        }
      },
      onPanResponderMove: (_e, gesture) => {
        // Travelling far enough means this is a drag: cancel the pending hold.
        if (Math.abs(gesture.dy) > LONG_PRESS_SLOP) clearHold();
        if (heldOpen.current) return;
        lastDy.current = gesture.dy;
        if (block.current) moveBlock(gesture.dy);
        else moveRow(gesture.dy);
        applyTranslate(gesture.dy - applied.current);
      },
      onPanResponderRelease: () => finish(),
      onPanResponderTerminate: () => finish(),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  /** Step this row past its neighbours, one at a time, as the finger passes. */
  const moveRow = (dy: number) => {
    const keys = orderRef.current;
    let at = slot.current;
    let moved = shift.current;

    // Past the next row's midpoint? Swap with it, and keep going in case
    // the finger travelled several rows in one frame.
    while (at < keys.length - 1) {
      const pitch = pitchOf(keys[at + 1]);
      if (pitch <= 0 || dy - moved <= pitch / 2 + SWAP_HYSTERESIS) break;
      latest.current.onReorder(at, at + 1);
      const [k] = keys.splice(at, 1);
      keys.splice(at + 1, 0, k);
      pending.current.push({ rows: 1, dist: pitch });
      moved += pitch;
      at += 1;
    }
    while (at > 0) {
      const pitch = pitchOf(keys[at - 1]);
      if (pitch <= 0 || dy - moved >= -pitch / 2 - SWAP_HYSTERESIS) break;
      latest.current.onReorder(at, at - 1);
      const [k] = keys.splice(at, 1);
      keys.splice(at - 1, 0, k);
      pending.current.push({ rows: -1, dist: -pitch });
      moved -= pitch;
      at -= 1;
    }

    slot.current = at;
    shift.current = moved;
  };

  /** The same, a whole block at a time: a section clears the next section. */
  const moveBlock = (dy: number) => {
    const state = block.current;
    if (!state) return;
    const keys = orderRef.current;
    const { blocks } = state;
    let moved = shift.current;

    while (state.at < blocks.length - 1) {
      const next = blocks[state.at + 1];
      const pitch = blockPitch(next);
      if (pitch <= 0 || dy - moved <= pitch / 2 + SWAP_HYSTERESIS) break;
      const mine = blocks[state.at];
      const from = flatStart(blocks, state.at);
      latest.current.onMoveBlock?.(from, mine.length, from + next.length);
      keys.splice(from, mine.length);
      keys.splice(from + next.length, 0, ...mine);
      blocks.splice(state.at, 2, next, mine);
      pending.current.push({ rows: next.length, dist: pitch });
      moved += pitch;
      state.at += 1;
    }
    while (state.at > 0) {
      const prev = blocks[state.at - 1];
      const pitch = blockPitch(prev);
      if (pitch <= 0 || dy - moved >= -pitch / 2 - SWAP_HYSTERESIS) break;
      const mine = blocks[state.at];
      const from = flatStart(blocks, state.at);
      const to = from - prev.length;
      latest.current.onMoveBlock?.(from, mine.length, to);
      keys.splice(from, mine.length);
      keys.splice(to, 0, ...mine);
      blocks.splice(state.at - 1, 2, mine, prev);
      pending.current.push({ rows: -prev.length, dist: -pitch });
      moved -= pitch;
      state.at -= 1;
    }

    shift.current = moved;
    slot.current = flatStart(blocks, state.at);
  };

  const finish = () => {
    clearHold();
    released.current = true;
    // Dropping while a swap is still in flight would put the row back in its
    // old slot for a frame; hold the offset until the new order lands.
    if (pending.current.length === 0) settle();
    else applyTranslate(lastDy.current - applied.current);
    if (!heldOpen.current) latest.current.onDragEnd();
  };

  // The parent has re-rendered this row into a new slot: only now is it safe
  // to take that distance out of the row's own translation.
  useLayoutEffect(() => {
    if (index === committedIndex.current) return;
    if (!active.current) {
      committedIndex.current = index;
      return;
    }
    let delta = index - committedIndex.current;
    committedIndex.current = index;
    while (pending.current.length > 0) {
      const next = pending.current[0];
      if (
        Math.sign(next.rows) !== Math.sign(delta) ||
        Math.abs(next.rows) > Math.abs(delta)
      ) {
        break;
      }
      pending.current.shift();
      applied.current += next.dist;
      delta -= next.rows;
    }
    if (released.current && pending.current.length === 0) settle();
    else applyTranslate(lastDy.current - applied.current);
  }, [index]);

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
