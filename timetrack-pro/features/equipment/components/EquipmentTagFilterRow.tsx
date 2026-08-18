import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { EquipmentTag } from '@/types/database';

interface Props {
  tags: EquipmentTag[] | undefined;
  /** Selected tag ids; empty means "no tag filter". */
  selected: readonly string[];
  onToggle: (tagId: string) => void;
  onClear: () => void;
}

/**
 * Tag filter for any equipment list — the same row admins and contractors
 * use. Multi-select and additive: two tags picked shows everything in either
 * one, so tapping a second chip never empties the list. Renders nothing until
 * an admin has created a tag.
 */
export default function EquipmentTagFilterRow({
  tags,
  selected,
  onToggle,
  onClear,
}: Props) {
  if (!tags || tags.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Ionicons name="pricetags-outline" size={14} color={Colors.textMuted} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
        keyboardShouldPersistTaps="handled"
      >
        {tags.map((tag) => {
          const active = selected.includes(tag.id);
          return (
            <Pressable
              key={tag.id}
              onPress={() => onToggle(tag.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter by ${tag.name}`}
              style={[s.chip, active && s.chipActive]}
            >
              {active ? (
                <Ionicons name="checkmark" size={12} color={Colors.accent} />
              ) : null}
              <Text style={[s.chipLabel, active && s.chipLabelActive]} numberOfLines={1}>
                {tag.name}
              </Text>
            </Pressable>
          );
        })}
        {selected.length > 0 ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear tag filter"
            style={s.clear}
          >
            <Ionicons name="close" size={12} color={Colors.textSecondary} />
            <Text style={s.clearLabel}>Clear</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  row: {
    gap: Spacing.xs,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
    minHeight: 32,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  chipLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    maxWidth: 160,
  },
  chipLabelActive: {
    color: Colors.accent,
  },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    minHeight: 32,
  },
  clearLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
