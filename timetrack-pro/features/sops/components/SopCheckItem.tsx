import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import type { SopItem } from '@/types/database';

interface SopCheckItemProps {
  item: SopItem & { checked: boolean; checked_by_name?: string | null };
  onToggle: (itemId: string, checked: boolean) => void;
  disabled?: boolean;
}

function SopCheckItem({ item, onToggle, disabled = false }: SopCheckItemProps) {
  if (item.item_type === 'section') {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.sectionDesc}>{item.description}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => onToggle(item.id, !item.checked)}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
        {item.checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, item.checked && styles.titleChecked]}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : null}
        {item.checked && item.checked_by_name ? (
          <Text style={styles.checkedBy}>Checked by {item.checked_by_name}</Text>
        ) : null}
        {item.equipment && item.equipment.length > 0 && (
          <View style={styles.tags}>
            {item.equipment.map((eq, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{typeof eq === 'string' ? eq : 'Equipment'}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Memoized: the checklist re-renders on every optimistic toggle, but only the
// toggled item's object identity changes.
export default React.memo(SopCheckItem);

const styles = StyleSheet.create({
  section: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  disabled: {
    opacity: 0.6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm + 4,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: FontWeight.bold,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  titleChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  description: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkedBy: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  tag: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
