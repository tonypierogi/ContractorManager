import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import PieceSwatch from '@/features/layouts/components/PieceSwatch';
import { describePiece } from '@/features/layouts/geometry';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { FurniturePiece } from '@/types/database';

interface Props {
  visible: boolean;
  pieces: FurniturePiece[];
  /** How many of each piece (by id) the layout already places. */
  placedCounts: Map<string, number>;
  onPick: (piece: FurniturePiece) => void;
  /** Close the sheet and open the furniture editor for a new piece. */
  onCreatePiece: () => void;
  onClose: () => void;
}

/** The furniture library, for dropping another piece into the room. */
export default function FurniturePickerSheet({
  visible,
  pieces,
  placedCounts,
  onPick,
  onCreatePiece,
  onClose,
}: Props) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add furniture"
      subtitle="Tap a piece to drop it in the middle of the room"
    >
      {pieces.length === 0 ? (
        <Text style={s.empty}>
          The library is empty. Measure a piece you own and it'll show up here.
        </Text>
      ) : (
        <View style={s.list}>
          {pieces.map((piece) => {
            const placed = placedCounts.get(piece.id) ?? 0;
            const atLimit = piece.quantity != null && placed >= piece.quantity;
            return (
              <Pressable
                key={piece.id}
                onPress={() => onPick(piece)}
                style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${piece.name}`}
              >
                <PieceSwatch piece={piece} size={36} />
                <View style={s.rowText}>
                  <Text style={s.name} numberOfLines={1}>
                    {piece.name}
                  </Text>
                  <Text style={s.meta}>{describePiece(piece)}</Text>
                </View>
                <Text style={[s.count, atLimit && s.countLimit]}>
                  {piece.quantity != null ? `${placed} / ${piece.quantity}` : placed ? `${placed} placed` : ''}
                </Text>
                <Ionicons name="add-circle" size={24} color={Colors.accent} />
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={s.footer}>
        <Button
          title="Measure a new piece"
          variant="secondary"
          size="sm"
          icon={<Ionicons name="resize-outline" size={16} color={Colors.text} />}
          onPress={onCreatePiece}
          fullWidth
        />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  list: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    minHeight: 56,
  },
  rowPressed: {
    backgroundColor: Colors.bgElevated,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  meta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  count: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  countLimit: {
    color: Colors.warning,
    fontWeight: '600',
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  footer: {
    marginTop: Spacing.md,
  },
});
