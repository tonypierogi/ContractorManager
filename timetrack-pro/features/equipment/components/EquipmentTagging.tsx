import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import {
  EQUIPMENT_MODE_DESCRIPTION,
  EQUIPMENT_MODE_LABEL,
} from '@/features/equipment/refs';
import type { Equipment, EquipmentLinkMode } from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export interface EquipmentChip {
  label: string;
  /** Omitted where links carry no mode (SOP items). */
  mode?: EquipmentLinkMode;
}

/** Tappable summary of tagged equipment (chips, or a placeholder). */
export function EquipmentBox({
  items,
  onPress,
}: {
  items: EquipmentChip[];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.equipmentBox} onPress={onPress} activeOpacity={0.7}>
      {items.length ? (
        <View style={s.chipsRow}>
          {items.map((chip, i) => (
            <View key={`${chip.label}-${i}`} style={s.chip}>
              {chip.mode ? (
                <Text
                  style={[
                    s.chipMode,
                    chip.mode === 'return' && s.chipModeReturn,
                  ]}
                >
                  {EQUIPMENT_MODE_LABEL[chip.mode]}
                </Text>
              ) : null}
              <Text style={s.chipText}>{chip.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.placeholder}>Tap to link equipment</Text>
      )}
    </TouchableOpacity>
  );
}

interface EquipmentPickerModalProps {
  visible: boolean;
  equipment: Equipment[] | undefined;
  /** equipment id -> how it's linked; absent ids aren't linked. */
  selected: Map<string, EquipmentLinkMode>;
  onSelect: (equipmentId: string, mode: EquipmentLinkMode) => void;
  /** False for SOP items, which link equipment without a mode. */
  showModes?: boolean;
  onClose: () => void;
}

/**
 * Link equipment to a task, one row per piece. Each row offers the two ways a
 * task can involve equipment — "Use" (go get it) and "Return" (put it back) —
 * and tapping the mode a piece already has unlinks it.
 */
export function EquipmentPickerModal({
  visible,
  equipment,
  selected,
  onSelect,
  showModes = true,
  onClose,
}: EquipmentPickerModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title="Link Equipment" size="sm">
      {showModes ? (
        <Text style={s.intro}>
          Use — {EQUIPMENT_MODE_DESCRIPTION.use.toLowerCase()}. Return —{' '}
          {EQUIPMENT_MODE_DESCRIPTION.return.toLowerCase()}.
        </Text>
      ) : null}

      {(equipment ?? []).length === 0 ? (
        <Text style={s.empty}>No equipment yet — add some on the Equipment screen first.</Text>
      ) : (
        (equipment ?? []).map((eq) => {
          const mode = selected.get(eq.id);
          if (!showModes) {
            return (
              <TouchableOpacity
                key={eq.id}
                style={s.row}
                onPress={() => onSelect(eq.id, 'use')}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!mode }}
              >
                <Ionicons
                  name={mode ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={mode ? Colors.accent : Colors.textSecondary}
                />
                <Text style={s.rowLabel}>{eq.name}</Text>
              </TouchableOpacity>
            );
          }
          return (
            <View key={eq.id} style={s.modeRow}>
              <Text style={s.rowLabel} numberOfLines={1}>
                {eq.name}
              </Text>
              <View style={s.segmented}>
                {(['use', 'return'] as EquipmentLinkMode[]).map((option) => {
                  const active = mode === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[s.segment, active && s.segmentActive]}
                      onPress={() => onSelect(eq.id, option)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${EQUIPMENT_MODE_LABEL[option]} ${eq.name}`}
                    >
                      <Ionicons
                        name={
                          option === 'use'
                            ? 'arrow-up-circle-outline'
                            : 'arrow-down-circle-outline'
                        }
                        size={14}
                        color={active ? Colors.bgPrimary : Colors.textSecondary}
                      />
                      <Text style={[s.segmentText, active && s.segmentTextActive]}>
                        {EQUIPMENT_MODE_LABEL[option]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
      <Button title="Done" onPress={onClose} fullWidth />
    </Modal>
  );
}

const s = StyleSheet.create({
  equipmentBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    padding: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  chipMode: {
    fontSize: FontSize.xxs,
    fontWeight: '700',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipModeReturn: {
    color: Colors.warning,
  },
  chipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  placeholder: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  intro: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  modeRow: {
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
  },
  rowLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  segmented: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
  },
  segmentActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  segmentText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.bgPrimary,
  },
});
