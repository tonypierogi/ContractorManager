import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ChecklistItemRow from '@/components/ui/ChecklistItemRow';
import { parseEquipmentRefs } from '@/features/equipment/refs';
import { Colors, Spacing, FontSize, FontWeight } from '@/constants/theme';
import type { SopItem } from '@/types/database';

interface SopCheckItemProps {
  item: SopItem & { checked: boolean; checked_by_name?: string | null };
  onToggle: (itemId: string, checked: boolean) => void;
  /** equipment id → display name; unresolved entries fall back to the raw
   * value (legacy SOP items stored names directly). */
  equipmentNames?: Map<string, string>;
  disabled?: boolean;
}

function SopCheckItem({
  item,
  onToggle,
  equipmentNames,
  disabled = false,
}: SopCheckItemProps) {
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

  const images = (Array.isArray(item.media) ? item.media : [])
    .filter((m) => m?.url && !String(m.type ?? '').startsWith('video'))
    .map((m) => m.url);

  return (
    <ChecklistItemRow
      title={item.title}
      description={item.description}
      images={images}
      equipment={parseEquipmentRefs(item.equipment).map((ref) => ({
        // SOP equipment has no per-item zones; legacy rows may store a plain
        // name instead of an id, so fall back to the raw value.
        name: equipmentNames?.get(ref.id) ?? ref.id,
      }))}
      checked={item.checked}
      checkedByName={item.checked_by_name}
      disabled={disabled}
      onToggle={() => onToggle(item.id, !item.checked)}
    />
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
});
