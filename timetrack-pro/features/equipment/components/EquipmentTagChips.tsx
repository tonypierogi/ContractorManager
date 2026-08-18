import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { EquipmentTag } from '@/types/database';

interface Props {
  tags: EquipmentTag[];
  /** Show at most this many, then "+N" — list rows stay one line tall. */
  max?: number;
}

/**
 * Read-only tag chips, on an equipment row or in its detail sheet. Muted on
 * purpose: tags label the item, the room it lives in is still the headline.
 */
export default function EquipmentTagChips({ tags, max }: Props) {
  if (tags.length === 0) return null;

  const shown = max ? tags.slice(0, max) : tags;
  const hidden = tags.length - shown.length;

  return (
    <View style={s.row}>
      {shown.map((tag) => (
        <View key={tag.id} style={s.chip}>
          <Text style={s.label} numberOfLines={1}>
            {tag.name}
          </Text>
        </View>
      ))}
      {hidden > 0 ? (
        <Text style={s.more} accessibilityLabel={`${hidden} more tags`}>
          +{hidden}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 140,
  },
  label: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  more: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
