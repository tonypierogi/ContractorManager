import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from '@/components/ui/Modal';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export interface PickerOption {
  value: string;
  label: string;
}

interface OptionPickerModalProps {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Simple touch-friendly option list (member filter, type filter, weeks…). */
export default function OptionPickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: OptionPickerModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title={title} size="sm">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.item, opt.value === selected && styles.itemSelected]}
          onPress={() => {
            onSelect(opt.value);
            onClose();
          }}
        >
          <Text
            style={[styles.itemText, opt.value === selected && styles.itemTextSelected]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </Modal>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  itemSelected: {
    backgroundColor: Colors.accentGlow,
  },
  itemText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  itemTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
