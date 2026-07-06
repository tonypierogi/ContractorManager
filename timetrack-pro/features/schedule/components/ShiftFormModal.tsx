import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { Profile } from '@/types/database';
import {
  buildNote,
  buildRepeatRows,
  buildTimeOffRows,
  type ShiftType,
} from '../api';
import {
  useCreateShifts,
  useDeleteScheduledShift,
  useUpdateShift,
} from '../hooks';
import {
  countInclusiveDays,
  getShiftTypeLabel,
  isValidDateInput,
  memberDisplayName,
  parseDateString,
  toDateString,
} from '../lib';
import OptionPickerModal from './OptionPickerModal';
import TimePickerField from './TimePickerField';

const REPEAT_WEEK_OPTIONS = [2, 3, 4, 6, 8, 12];

export interface ShiftFormInitial {
  id?: string;
  employeeId?: string;
  date?: string; // 'YYYY-MM-DD'
  type?: ShiftType;
  startTime?: string; // 'HH:MM'
  endTime?: string;
  note?: string; // decoded (no [OFF]/[OOT] prefix)
}

interface ShiftFormModalProps {
  visible: boolean;
  onClose: () => void;
  members: Profile[]; // full sorted list
  initial: ShiftFormInitial | null;
  onSaved?: (info: { type: ShiftType; startDate: string; multi: boolean }) => void;
}

const TYPE_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: 'shift', label: 'Regular' },
  { value: 'time_off', label: '🏖 Time Off' },
  { value: 'out_of_town', label: '✈ Out of Town' },
];

export default function ShiftFormModal({
  visible,
  onClose,
  members,
  initial,
  onSaved,
}: ShiftFormModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const createShifts = useCreateShifts();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteScheduledShift();

  const editId = initial?.id;
  const isEdit = !!editId;

  const [type, setType] = useState<ShiftType>('shift');
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [showWeeksPicker, setShowWeeksPicker] = useState(false);
  // Errors render inline: toasts mount behind the native Modal and would be
  // invisible while it is open.
  const [errorText, setErrorText] = useState('');

  // Reset the form each time the modal opens (legacy modal defaults).
  useEffect(() => {
    if (!visible) return;
    const today = toDateString(new Date());
    setType(initial?.type ?? 'shift');
    setEmployeeId(initial?.employeeId ?? '');
    setDate(initial?.date || today);
    setEndDate(initial?.date || today);
    setStartTime(initial?.startTime ?? '');
    setEndTime(initial?.endTime ?? '');
    setNote(initial?.note ?? '');
    setRepeat(false);
    setRepeatWeeks(4);
    setErrorText('');
  }, [visible, initial]);

  const isTimeOff = type !== 'shift';
  const title = isTimeOff
    ? isEdit
      ? 'Edit Time Off'
      : 'Schedule Time Off'
    : isEdit
      ? 'Edit Scheduled Shift'
      : 'Schedule Shift';
  const saveLabel = isEdit ? 'Update' : isTimeOff ? 'Save Time Off' : 'Save';

  const saving =
    createShifts.isPending || updateShift.isPending || deleteShift.isPending;

  // Live day-count line for multi-day time-off creation.
  let dayCountText = '';
  let dayCountError = false;
  if (isTimeOff && !isEdit && isValidDateInput(date) && isValidDateInput(endDate)) {
    const days = countInclusiveDays(date, endDate);
    if (days < 1) {
      dayCountText = 'End date must be on or after start date';
      dayCountError = true;
    } else {
      dayCountText = days === 1 ? '1 day' : `${days} days`;
    }
  }

  const handleSave = async () => {
    if (!user) return;
    setErrorText('');

    if (isTimeOff) {
      const reason = note.trim();
      if (
        !employeeId ||
        !isValidDateInput(date) ||
        (!isEdit && !isValidDateInput(endDate))
      ) {
        setErrorText('Please fill in all required fields (dates as YYYY-MM-DD)');
        return;
      }
      try {
        if (isEdit && editId) {
          // Editing a day edits ONLY that day (rows are independent).
          await updateShift.mutateAsync({
            id: editId,
            patch: {
              employee_id: employeeId,
              shift_date: date,
              start_time: '00:00',
              end_time: '23:59',
              note: buildNote(type, reason),
            },
          });
          showToast('Updated!');
        } else {
          if (parseDateString(endDate) < parseDateString(date)) {
            setErrorText('End date must be on or after start date');
            return;
          }
          const rows = buildTimeOffRows({
            employeeId,
            startDate: date,
            endDate,
            type,
            reason,
            createdBy: user.id,
          });
          await createShifts.mutateAsync(rows);
          const days = rows.length;
          showToast(
            `${getShiftTypeLabel(type)} scheduled for ${days} day${days > 1 ? 's' : ''}`,
          );
        }
        onSaved?.({ type, startDate: date, multi: false });
        onClose();
      } catch (error) {
        setErrorText(
          error instanceof Error ? error.message : 'Failed to save. Please try again.',
        );
      }
      return;
    }

    // Regular shift
    if (!employeeId || !isValidDateInput(date) || !startTime || !endTime) {
      setErrorText('Please fill in all required fields (date as YYYY-MM-DD)');
      return;
    }
    const encodedNote = note.trim() || null;
    try {
      if (isEdit && editId) {
        await updateShift.mutateAsync({
          id: editId,
          patch: {
            employee_id: employeeId,
            shift_date: date,
            start_time: startTime,
            end_time: endTime,
            note: encodedNote,
          },
        });
        showToast('Updated!');
        onSaved?.({ type, startDate: date, multi: false });
      } else {
        const weeks = repeat ? repeatWeeks : 1;
        const rows = buildRepeatRows({
          employeeId,
          startDate: date,
          startTime,
          endTime,
          note: encodedNote,
          weeks,
          createdBy: user.id,
        });
        await createShifts.mutateAsync(rows);
        if (repeat) {
          const lastDate = parseDateString(date);
          lastDate.setDate(lastDate.getDate() + (weeks - 1) * 7);
          showToast(
            `${weeks} shifts scheduled through ${lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          );
        } else {
          showToast('Shift scheduled!');
        }
        onSaved?.({ type, startDate: date, multi: repeat });
      }
      onClose();
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : 'Failed to save. Please try again.',
      );
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    Alert.alert('Delete this scheduled shift?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShift.mutateAsync(editId);
            showToast('Shift removed from schedule');
            onClose();
          } catch (error) {
            setErrorText(
              error instanceof Error ? error.message : 'Failed to delete. Please try again.',
            );
          }
        },
      },
    ]);
  };

  const selectedMember = members.find((m) => m.id === employeeId);

  return (
    <Modal visible={visible} onClose={onClose} title={title} size="sm">
      {/* Shift type selector */}
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.typeBtn, type === opt.value && styles.typeBtnActive]}
            onPress={() => setType(opt.value)}
          >
            <Text
              style={[styles.typeText, type === opt.value && styles.typeTextActive]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Employee picker */}
      <Text style={styles.fieldLabel}>Team Member</Text>
      <TouchableOpacity
        style={styles.pickerField}
        onPress={() => setShowEmployeePicker(true)}
      >
        <Text style={selectedMember ? styles.pickerText : styles.pickerPlaceholder}>
          {selectedMember ? memberDisplayName(selectedMember) : 'Select team member'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {isTimeOff ? (
        <>
          <Input
            label={isEdit ? 'Date' : 'Start Date'}
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
          />
          {!isEdit && (
            <Input
              label="End Date"
              placeholder="YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
            />
          )}
          {dayCountText ? (
            <Text style={[styles.dayCount, dayCountError && styles.dayCountError]}>
              {dayCountText}
            </Text>
          ) : null}
          <Input
            label="Reason (optional)"
            placeholder="e.g. Vacation, Doctor appointment"
            value={note}
            onChangeText={setNote}
          />
        </>
      ) : (
        <>
          <Input
            label="Date"
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
          />
          <View style={styles.timeRow}>
            <TimePickerField label="Start Time" value={startTime} onChange={setStartTime} />
            <TimePickerField label="End Time" value={endTime} onChange={setEndTime} />
          </View>
          <Input
            label="Note (optional)"
            placeholder="e.g. Opening shift, Delivery run"
            value={note}
            onChangeText={setNote}
          />
          {!isEdit && (
            <>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRepeat((r) => !r)}
              >
                <Ionicons
                  name={repeat ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={repeat ? Colors.accent : Colors.textMuted}
                />
                <Text style={styles.checkboxLabel}>Repeat weekly</Text>
              </TouchableOpacity>
              {repeat && (
                <>
                  <Text style={styles.fieldLabel}>Number of weeks</Text>
                  <TouchableOpacity
                    style={styles.pickerField}
                    onPress={() => setShowWeeksPicker(true)}
                  >
                    <Text style={styles.pickerText}>{repeatWeeks} weeks</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </>
      )}

      <View style={styles.actions}>
        {isEdit && (
          <Button
            title="Delete"
            variant="danger"
            onPress={handleDelete}
            disabled={saving}
          />
        )}
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        <View style={styles.actionsRight}>
          <Button title="Cancel" variant="secondary" onPress={onClose} />
          <Button title={saveLabel} onPress={handleSave} loading={saving} />
        </View>
      </View>

      <OptionPickerModal
        visible={showEmployeePicker}
        title="Team Member"
        options={members.map((m) => ({ value: m.id, label: memberDisplayName(m) }))}
        selected={employeeId}
        onSelect={setEmployeeId}
        onClose={() => setShowEmployeePicker(false)}
      />
      <OptionPickerModal
        visible={showWeeksPicker}
        title="Number of weeks"
        options={REPEAT_WEEK_OPTIONS.map((w) => ({
          value: String(w),
          label: `${w} weeks`,
        }))}
        selected={String(repeatWeeks)}
        onSelect={(v) => setRepeatWeeks(parseInt(v, 10) || 4)}
        onClose={() => setShowWeeksPicker(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  typeBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  typeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  typeTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    marginBottom: Spacing.md,
    minHeight: 48,
  },
  pickerText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  pickerPlaceholder: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  timeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dayCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  dayCountError: {
    color: Colors.danger,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    minHeight: 44,
  },
  checkboxLabel: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    flexShrink: 1,
    marginRight: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  actionsRight: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginLeft: 'auto',
  },
});
