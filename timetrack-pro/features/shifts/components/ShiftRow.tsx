import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { formatDate, formatTime, formatCurrency } from '@/utils/format';
import type { TimeEntry } from '@/types/database';

interface ShiftRowProps {
  shift: TimeEntry;
  hourlyRate?: number;
  onDelete?: () => void;
}

function getShiftHours(clockIn: string, clockOut: string | null): number {
  // In-progress shifts show 0 hours until clocked out (legacy parity; keeps
  // rows consistent with totals and the spreadsheet export).
  if (!clockOut) return 0;
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  return (end - start) / 3600000;
}

export default function ShiftRow({ shift, hourlyRate = 0, onDelete }: ShiftRowProps) {
  const hours = getShiftHours(shift.clock_in, shift.clock_out);
  const isActive = !shift.clock_out;
  const amount = hours * hourlyRate;
  const isPaid = shift.paid;

  return (
    <View style={styles.row}>
      <View style={styles.colDate}>
        <Text style={styles.cellText}>{formatDate(shift.clock_in)}</Text>
      </View>
      <View style={styles.colTime}>
        <Text style={styles.cellText}>{formatTime(shift.clock_in)}</Text>
      </View>
      <View style={styles.colTime}>
        {isActive ? (
          <Text style={[styles.cellText, styles.mutedItalic]}>In progress</Text>
        ) : (
          <Text style={styles.cellText}>{formatTime(shift.clock_out!)}</Text>
        )}
      </View>
      <View style={styles.colHours}>
        <Text style={styles.cellText}>{hours.toFixed(1)}</Text>
      </View>
      <View style={styles.colStatus}>
        <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgePending]}>
          <Text style={[styles.badgeText, isPaid ? styles.badgePaidText : styles.badgePendingText]}>
            {isPaid ? 'Paid' : 'Pending'}
          </Text>
        </View>
      </View>
      <View style={styles.colAmount}>
        <Text style={styles.amountText}>{formatCurrency(amount)}</Text>
      </View>
      <View style={styles.colAction}>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={8}>
            <Text style={styles.deleteIcon}>{'\u2715'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colDate: {
    flex: 2.2,
  },
  colTime: {
    flex: 1.6,
  },
  colHours: {
    flex: 1,
    alignItems: 'flex-end',
  },
  colStatus: {
    flex: 1.4,
    alignItems: 'center',
  },
  colAmount: {
    flex: 1.6,
    alignItems: 'flex-end',
  },
  colAction: {
    width: 32,
    alignItems: 'center',
  },
  cellText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  mutedItalic: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  badgePaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  badgePaidText: {
    color: Colors.success,
  },
  badgePendingText: {
    color: Colors.warning,
  },
  amountText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
  },
  deleteIcon: {
    fontSize: FontSize.sm,
    color: Colors.danger,
  },
});
