import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatScheduleTime } from '../lib';

interface TimePickerFieldProps {
  label: string;
  value: string; // 'HH:MM' or '' when unset
  onChange: (value: string) => void;
}

const ITEM_HEIGHT = 48;

// 96 options in 15-minute increments (touch-friendly picker, no native dep).
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    );
  }
}

const QUICK_TIMES: { label: string; value: string }[] = [
  { label: '9 AM', value: '09:00' },
  { label: '12 PM', value: '12:00' },
  { label: '5 PM', value: '17:00' },
];

/** Legacy 'Now' quick-select: current time rounded to the nearest 5 minutes. */
function nowRounded(): string {
  const now = new Date();
  let h = now.getHours();
  let m = Math.round(now.getMinutes() / 5) * 5;
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function TimePickerField({
  label,
  value,
  onChange,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const initialIndex = useMemo(() => {
    const source = value || nowRounded();
    const [h, m] = source.split(':').map(Number);
    const idx = Math.floor((h * 60 + m) / 15);
    return Math.min(Math.max(idx, 0), TIME_OPTIONS.length - 1);
  }, [value, open]);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)}>
        <Text style={value ? styles.fieldText : styles.fieldPlaceholder}>
          {value ? formatScheduleTime(value) : 'Tap to set'}
        </Text>
        <Ionicons name="time-outline" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} onClose={() => setOpen(false)} title={label} size="sm">
        <View style={styles.quickRow}>
          {QUICK_TIMES.map((q) => (
            <TouchableOpacity
              key={q.value}
              style={styles.quickBtn}
              onPress={() => select(q.value)}
            >
              <Text style={styles.quickText}>{q.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.quickBtn} onPress={() => select(nowRounded())}>
            <Text style={styles.quickText}>Now</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={TIME_OPTIONS}
          keyExtractor={(item) => item}
          style={styles.list}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, item === value && styles.itemSelected]}
              onPress={() => select(item)}
            >
              <Text
                style={[styles.itemText, item === value && styles.itemTextSelected]}
              >
                {formatScheduleTime(item)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    flex: 1,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    minHeight: 48,
  },
  fieldText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  fieldPlaceholder: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  quickText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: '600',
  },
  list: {
    maxHeight: 320,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
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
