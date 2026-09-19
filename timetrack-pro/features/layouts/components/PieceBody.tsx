import { View, StyleSheet } from 'react-native';
import type { FurnitureShape } from '@/types/database';

interface Props {
  shape: FurnitureShape;
  /** Overall size in px. */
  width: number;
  height: number;
  /** Arm depth of an L, in px. Ignored for other shapes. */
  arm?: number;
  fill: string;
  borderColor: string;
  borderWidth: number;
}

/**
 * A piece's outline at a given size: a rectangle, an ellipse, or an L (one arm
 * across the top, one down the left). Fills its parent's top-left corner;
 * rotation and mirroring are the parent's job.
 */
export default function PieceBody({ shape, width, height, arm, fill, borderColor, borderWidth }: Props) {
  if (shape === 'l' && arm && arm < width && arm < height) {
    return (
      <View style={{ width, height }} pointerEvents="none">
        {/* Across the top, full width. */}
        <View
          style={[
            s.bar,
            { left: 0, top: 0, width, height: arm, backgroundColor: fill, borderColor, borderWidth },
            s.topBar,
          ]}
        />
        {/* Down the left, starting just over the top arm's bottom edge so the
            joint reads as one piece rather than two boxes touching. */}
        <View
          style={[
            s.bar,
            {
              left: 0,
              top: arm - borderWidth,
              width: arm,
              height: height - arm + borderWidth,
              backgroundColor: fill,
              borderColor,
              borderWidth,
              borderTopWidth: 0,
            },
            s.sideBar,
          ]}
        />
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={{
        width,
        height,
        backgroundColor: fill,
        borderColor,
        borderWidth,
        borderRadius: shape === 'round' ? Math.max(width, height) / 2 : Math.min(3, width / 6),
      }}
    />
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
  },
  topBar: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  sideBar: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
