import { View, Image, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '@/constants/theme';
import { DEFAULT_PIECE_COLOR } from '@/features/layouts/geometry';
import PieceBody from '@/features/layouts/components/PieceBody';
import type { FurniturePiece } from '@/types/database';

interface Props {
  piece: Pick<FurniturePiece, 'shape' | 'width_in' | 'depth_in' | 'color'> & {
    arm_in?: number | null;
    photo_url?: string | null;
  };
  /** The square the piece is fitted into. */
  size: number;
}

/**
 * The list icon for a piece: its photo when it has one (with a dot in its
 * plan colour, so the list still ties back to the plan), otherwise the piece
 * drawn at its own proportions.
 */
export default function PieceSwatch({ piece, size }: Props) {
  const inner = size - 8;
  const k = inner / Math.max(piece.width_in, piece.depth_in);
  const w = Math.max(3, piece.width_in * k);
  const h = Math.max(3, piece.depth_in * k);
  const color = piece.color || DEFAULT_PIECE_COLOR;

  if (piece.photo_url) {
    const dot = Math.max(8, Math.round(size / 4));
    return (
      <View style={[s.box, { width: size, height: size }]}>
        <Image source={{ uri: piece.photo_url }} style={s.photo} resizeMode="cover" />
        <View
          style={[
            s.dot,
            { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={[s.box, { width: size, height: size }]}>
      <PieceBody
        shape={piece.shape}
        width={w}
        height={h}
        arm={piece.arm_in ? Math.max(2, piece.arm_in * k) : undefined}
        fill={piece.shape === 'l' ? color : color + 'b3'}
        borderColor={color}
        borderWidth={1}
      />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  dot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    borderWidth: 1.5,
    borderColor: Colors.bgPrimary,
  },
});
