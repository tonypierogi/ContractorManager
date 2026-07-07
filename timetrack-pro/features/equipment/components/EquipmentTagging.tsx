import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { Equipment } from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

/** Tappable summary of tagged equipment (chips, or a placeholder). */
export function EquipmentBox({ labels, onPress }: { labels: string[]; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.equipmentBox} onPress={onPress} activeOpacity={0.7}>
      {labels.length ? (
        <View style={s.chipsRow}>
          {labels.map((label, i) => (
            <View key={`${label}-${i}`} style={s.chip}>
              <Text style={s.chipText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.placeholder}>Tap to tag equipment</Text>
      )}
    </TouchableOpacity>
  );
}

interface EquipmentPickerModalProps {
  visible: boolean;
  equipment: Equipment[] | undefined;
  selectedIds: string[];
  onToggle: (equipmentId: string) => void;
  onClose: () => void;
}

/** Multi-select checklist over the equipment table. */
export function EquipmentPickerModal({
  visible,
  equipment,
  selectedIds,
  onToggle,
  onClose,
}: EquipmentPickerModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title="Tag Equipment" size="sm">
      {(equipment ?? []).length === 0 ? (
        <Text style={s.empty}>No equipment yet — add some on the Equipment screen first.</Text>
      ) : (
        (equipment ?? []).map((eq) => {
          const selected = selectedIds.includes(eq.id);
          return (
            <TouchableOpacity
              key={eq.id}
              style={s.row}
              onPress={() => onToggle(eq.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={selected ? 'checkbox' : 'square-outline'}
                size={22}
                color={selected ? Colors.accent : Colors.textSecondary}
              />
              <Text style={s.rowLabel}>{eq.name}</Text>
            </TouchableOpacity>
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
    fontSize: FontSize.sm,
    color: Colors.textMuted,
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
  rowLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
});
