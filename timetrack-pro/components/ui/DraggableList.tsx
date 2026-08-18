import React, { useRef, useState } from 'react';
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
  renderItem: (info: DragRenderInfo<T>) => React.ReactNode;
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
  renderItem,
}: DraggableListProps<T>) {
  // Row pitch (height plus its own margin), keyed by item — the drag needs to
  // know how far a neighbour is before it can decide to swap with it.
  const heights = useRef<Record<string, number>>({});
  // The working order during a gesture; re-derived from props every render.
  const orderRef = useRef<string[]>([]);
  orderRef.current = data.map(keyExtractor);

  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  return (
    <View>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        return (
          <DraggableRow
            key={key}
            itemKey={key}
            index={index}
            heights={heights}
            orderRef={orderRef}
            onReorder={onReorder}
            dragging={draggingKey === key}
            onDragStart={() => setDraggingKey(key)}
            onDragEnd={() => setDraggingKey(null)}
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
  heights: React.MutableRefObject<Record<string, number>>;
  orderRef: React.MutableRefObject<string[]>;
  onReorder: (from: number, to: number) => void;
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
  heights,
  orderRef,
  onReorder,
  dragging,
  onDragStart,
  onDragEnd,
  render,
}: DraggableRowProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  // The PanResponder is built once, so everything it reads goes through refs.
  const latest = useRef({ index, onReorder, onDragStart, onDragEnd });
  latest.current = { index, onReorder, onDragStart, onDragEnd };
  // Where the row currently sits, and how far its slot has moved so far.
  const slot = useRef(index);
  const shift = useRef(0);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        slot.current = latest.current.index;
        shift.current = 0;
        translateY.setValue(0);
        latest.current.onDragStart();
      },
      onPanResponderMove: (_e, gesture) => {
        const keys = orderRef.current;
        let at = slot.current;
        let moved = shift.current;

        // Past the next row's midpoint? Swap with it, and keep going in case
        // the finger travelled several rows in one frame.
        while (at < keys.length - 1) {
          const height = heights.current[keys[at + 1]] ?? 0;
          if (height <= 0 || gesture.dy - moved <= height / 2) break;
          latest.current.onReorder(at, at + 1);
          const [k] = keys.splice(at, 1);
          keys.splice(at + 1, 0, k);
          moved += height;
          at += 1;
        }
        while (at > 0) {
          const height = heights.current[keys[at - 1]] ?? 0;
          if (height <= 0 || gesture.dy - moved >= -height / 2) break;
          latest.current.onReorder(at, at - 1);
          const [k] = keys.splice(at, 1);
          keys.splice(at - 1, 0, k);
          moved -= height;
          at -= 1;
        }

        slot.current = at;
        shift.current = moved;
        translateY.setValue(gesture.dy - moved);
      },
      onPanResponderRelease: () => {
        translateY.setValue(0);
        latest.current.onDragEnd();
      },
      onPanResponderTerminate: () => {
        translateY.setValue(0);
        latest.current.onDragEnd();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    heights.current[itemKey] = e.nativeEvent.layout.height;
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
