import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface AddShiftModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { clockIn: string; clockOut: string; description?: string }) => void;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AddShiftModal({ visible, onClose, onSave }: AddShiftModalProps) {
  const [date, setDate] = useState(todayStr());
  const [clockIn, setClockIn] = useState('09:00');
  const [clockOut, setClockOut] = useState('17:00');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = 'Use YYYY-MM-DD format';
    if (!/^\d{2}:\d{2}$/.test(clockIn)) e.clockIn = 'Use HH:MM format';
    if (!/^\d{2}:\d{2}$/.test(clockOut)) e.clockOut = 'Use HH:MM format';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const inISO = new Date(`${date}T${clockIn}:00`).toISOString();
    const outISO = new Date(`${date}T${clockOut}:00`).toISOString();
    onSave({
      clockIn: inISO,
      clockOut: outISO,
      description: description.trim() || undefined,
    });
    resetForm();
  }

  function resetForm() {
    setDate(todayStr());
    setClockIn('09:00');
    setClockOut('17:00');
    setDescription('');
    setErrors({});
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  return (
    <Modal visible={visible} onClose={handleClose} title="Add Manual Shift">
      <Input
        label="Date"
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
        error={errors.date}
        keyboardType="numbers-and-punctuation"
      />
      <Input
        label="Clock In Time"
        placeholder="HH:MM"
        value={clockIn}
        onChangeText={setClockIn}
        error={errors.clockIn}
        keyboardType="numbers-and-punctuation"
      />
      <Input
        label="Clock Out Time"
        placeholder="HH:MM"
        value={clockOut}
        onChangeText={setClockOut}
        error={errors.clockOut}
        keyboardType="numbers-and-punctuation"
      />
      <Input
        label="Description (optional)"
        placeholder="What did you work on?"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <View style={styles.buttons}>
        <View style={styles.buttonWrapper}>
          <Button title="Cancel" variant="secondary" onPress={handleClose} fullWidth />
        </View>
        <View style={styles.buttonWrapper}>
          <Button title="Save Shift" variant="primary" onPress={handleSave} fullWidth />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  buttons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  buttonWrapper: {
    flex: 1,
  },
});
