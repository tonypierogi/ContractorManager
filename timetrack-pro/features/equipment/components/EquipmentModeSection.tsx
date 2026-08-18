import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LocationZonePicker from '@/features/locations/components/LocationZonePicker';
import {
  EQUIPMENT_MODE_FIELD_LABEL,
  EQUIPMENT_MODE_LABEL,
  EQUIPMENT_ZONE_LABEL,
  refsForMode,
} from '@/features/equipment/refs';
import type { EquipmentLinkMode, TaskEquipmentRef } from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface Props {
  mode: EquipmentLinkMode;
  /** Every ref on the task; this section renders only its own mode's. */
  refs: TaskEquipmentRef[];
  /** equipment id -> display name */
  equipmentById: Map<string, string>;
  /** False on SOP items, which carry no zones of their own to fall back to. */
  showZones?: boolean;
  onAdd: () => void;
  onSetPlacement: (
    equipmentId: string,
    field: 'from' | 'to',
    zoneId: string | null,
  ) => void;
  onSetMode: (equipmentId: string, mode: EquipmentLinkMode) => void;
  onRemove: (equipmentId: string) => void;
}

const OTHER_MODE: Record<EquipmentLinkMode, EquipmentLinkMode> = {
  use: 'return',
  return: 'use',
};

/**
 * One side of a task's equipment: everything to get, or everything to bring
 * back. Two of these replace the old single equipment field — "clean and put
 * up the cutting boards" now reads as cutting boards under Bring, so where the
 * gear ends up is visible without opening anything.
 */
export default function EquipmentModeSection({
  mode,
  refs,
  equipmentById,
  showZones = true,
  onAdd,
  onSetPlacement,
  onSetMode,
  onRemove,
}: Props) {
  const mine = refsForMode(refs, mode);
  const zoneLabels = EQUIPMENT_ZONE_LABEL[mode];

  return (
    <View style={s.section}>
      <Text style={s.fieldLabel}>{EQUIPMENT_MODE_FIELD_LABEL[mode]}</Text>

      <TouchableOpacity
        style={s.box}
        onPress={onAdd}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Add ${EQUIPMENT_MODE_FIELD_LABEL[mode].toLowerCase()}`}
      >
        {mine.length ? (
          <View style={s.chipsRow}>
            {mine.map((ref) => (
              <View key={ref.id} style={s.chip}>
                <Text style={s.chipText}>
                  {equipmentById.get(ref.id) ?? 'Unknown'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.placeholder}>
            Tap to add equipment to {mode === 'use' ? 'get' : 'bring'}
          </Text>
        )}
        <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
      </TouchableOpacity>

      {showZones &&
        mine.map((ref) => (
          <View key={ref.id} style={s.placementCard}>
            <View style={s.placementHeader}>
              <Text style={s.placementName} numberOfLines={1}>
                {equipmentById.get(ref.id) ?? 'Unknown equipment'}
              </Text>
              <TouchableOpacity
                onPress={() => onSetMode(ref.id, OTHER_MODE[mode])}
                style={s.moveBtn}
                accessibilityRole="button"
                accessibilityLabel={`Move to ${EQUIPMENT_MODE_LABEL[OTHER_MODE[mode]]}`}
              >
                <Ionicons name="swap-horizontal" size={13} color={Colors.textSecondary} />
                <Text style={s.moveText}>
                  Move to {EQUIPMENT_MODE_LABEL[OTHER_MODE[mode]].toLowerCase()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onRemove(ref.id)}
                style={s.removeBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${equipmentById.get(ref.id) ?? 'equipment'}`}
                hitSlop={6}
              >
                <Ionicons name="close" size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>

            <LocationZonePicker
              label={zoneLabels.from}
              value={ref.from}
              onChange={(z) => onSetPlacement(ref.id, 'from', z)}
            />
            <LocationZonePicker
              label={zoneLabels.to}
              value={ref.to}
              onChange={(z) => onSetPlacement(ref.id, 'to', z)}
            />
          </View>
        ))}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    marginTop: Spacing.xs,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    padding: Spacing.sm,
    minHeight: 44,
    marginBottom: Spacing.sm,
  },
  chipsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  placeholder: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  placementCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  placementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  placementName: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: Spacing.xs,
  },
  moveText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  removeBtn: {
    padding: 4,
  },
});
