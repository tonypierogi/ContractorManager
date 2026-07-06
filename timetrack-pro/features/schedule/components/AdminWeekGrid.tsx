import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import type { Profile } from '@/types/database';
import { parseShiftType, type ScheduledShift } from '../api';
import {
  addDays,
  calcShiftHours,
  formatEndTime,
  formatScheduleTime,
  getShiftTypeLabel,
  isSameDay,
  memberDisplayName,
  memberInitials,
  toDateString,
  type LoggedDisplayShift,
} from '../lib';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LABEL_WIDTH = 128;
const COL_WIDTH = 108;

interface AdminWeekGridProps {
  weekStart: Date;
  displayMembers: Profile[]; // filtered + hidden removed
  hiddenCount: number;
  shifts: ScheduledShift[];
  logged: LoggedDisplayShift[];
  typeFilter: 'both' | 'scheduled' | 'logged';
  colorFor: (memberId: string) => string;
  onAdd: (memberId: string, dateStr: string) => void;
  onEdit: (shift: ScheduledShift) => void;
  onDelete: (id: string) => void;
}

export default function AdminWeekGrid({
  weekStart,
  displayMembers,
  hiddenCount,
  shifts,
  logged,
  typeFilter,
  colorFor,
  onAdd,
  onEdit,
  onDelete,
}: AdminWeekGridProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (displayMembers.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.emptyText}>
          {hiddenCount > 0
            ? 'All members are hidden. Click "Show all" below to restore.'
            : 'No team members found. Add team members first.'}
        </Text>
      </View>
    );
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  let grandTotalHours = 0;
  let grandTotalCost = 0;

  const rows = displayMembers.map((member) => {
    const rate = member.hourly_rate || 0;
    const color = colorFor(member.id);

    const cells = days.map((d) => {
      const dateStr = toDateString(d);
      const isToday = isSameDay(d, today);

      const scheduledShifts =
        typeFilter !== 'logged'
          ? shifts.filter(
              (s) => s.shift_date === dateStr && s.employee_id === member.id,
            )
          : [];
      const loggedShifts =
        typeFilter !== 'scheduled'
          ? logged.filter(
              (s) => s.shift_date === dateStr && s.employee_id === member.id,
            )
          : [];

      return (
        <View key={dateStr} style={[styles.cell, isToday && styles.cellToday]}>
          {scheduledShifts.map((shift) => {
            const decoded = parseShiftType(shift.note);
            if (decoded.type !== 'shift') {
              const isOOT = decoded.type === 'out_of_town';
              return (
                <TouchableOpacity
                  key={shift.id}
                  style={[styles.chip, isOOT ? styles.ootChip : styles.timeoffChip]}
                  onPress={() => onEdit(shift)}
                >
                  <Text
                    style={[
                      styles.chipTime,
                      { color: isOOT ? '#3b82f6' : Colors.warning },
                    ]}
                    numberOfLines={1}
                  >
                    {getShiftTypeLabel(decoded.type)}
                  </Text>
                  {decoded.note ? (
                    <Text style={styles.chipNote} numberOfLines={1}>
                      {decoded.note}
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    style={styles.chipDelete}
                    hitSlop={8}
                    onPress={() => onDelete(shift.id)}
                  >
                    <Text style={styles.chipDeleteText}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }

            const hrs = calcShiftHours(shift.start_time, shift.end_time);
            const cost = hrs * rate;
            grandTotalHours += hrs;
            grandTotalCost += cost;

            return (
              <TouchableOpacity
                key={shift.id}
                style={[styles.chip, { backgroundColor: color + '22' }]}
                onPress={() => onEdit(shift)}
              >
                <Text style={[styles.chipTime, { color }]} numberOfLines={2}>
                  {formatScheduleTime(shift.start_time)} –{' '}
                  {formatEndTime(shift.start_time, shift.end_time)}
                </Text>
                {rate ? (
                  <Text style={styles.chipCost} numberOfLines={1}>
                    {hrs.toFixed(1)}h · {formatCurrency(cost)}
                  </Text>
                ) : null}
                {decoded.note ? (
                  <Text style={styles.chipNote} numberOfLines={1}>
                    {decoded.note}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={styles.chipDelete}
                  hitSlop={8}
                  onPress={() => onDelete(shift.id)}
                >
                  <Text style={styles.chipDeleteText}>×</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

          {loggedShifts.map((shift) => {
            const cost = shift.hours * rate;
            return (
              <View key={shift.id} style={[styles.chip, styles.loggedChip]}>
                <Text style={styles.loggedTime} numberOfLines={2}>
                  {formatScheduleTime(shift.start_time)} –{' '}
                  {formatEndTime(shift.start_time, shift.end_time)}
                </Text>
                {rate ? (
                  <Text style={styles.chipCost} numberOfLines={1}>
                    {shift.hours.toFixed(1)}h · {formatCurrency(cost)}
                  </Text>
                ) : null}
                <Text style={[styles.loggedBadge, shift.paid && styles.loggedBadgePaid]}>
                  {shift.paid ? '✓ Paid' : 'Logged'}
                </Text>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.addCell}
            onPress={() => onAdd(member.id, dateStr)}
          >
            <Ionicons name="add" size={12} color={Colors.textMuted} />
            <Text style={styles.addCellText}>Add</Text>
          </TouchableOpacity>
        </View>
      );
    });

    return (
      <View key={member.id} style={styles.memberRow}>
        <View style={styles.memberLabel}>
          <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
            <Text style={[styles.avatarText, { color }]}>
              {memberInitials(member)}
            </Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName} numberOfLines={1}>
              {memberDisplayName(member)}
            </Text>
            {member.hourly_rate ? (
              <Text style={styles.memberRate}>
                {formatCurrency(member.hourly_rate)}/hr
              </Text>
            ) : null}
          </View>
        </View>
        {cells}
      </View>
    );
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.headerRow}>
          <View style={styles.corner} />
          {days.map((d) => {
            const isToday = isSameDay(d, today);
            return (
              <View
                key={d.toISOString()}
                style={[styles.dayHeader, isToday && styles.dayHeaderToday]}
              >
                <Text
                  style={[styles.dayHeaderText, isToday && styles.dayHeaderTextToday]}
                >
                  {DAY_NAMES[d.getDay()]}
                </Text>
                <Text
                  style={[styles.dayHeaderDate, isToday && styles.dayHeaderTextToday]}
                >
                  {d.getDate()}
                </Text>
              </View>
            );
          })}
        </View>
        {rows}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Week Total (Scheduled)</Text>
          <Text style={styles.totalsValue}>
            {grandTotalHours.toFixed(1)} hrs · {formatCurrency(grandTotalCost)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  corner: {
    width: LABEL_WIDTH,
  },
  dayHeader: {
    width: COL_WIDTH,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  dayHeaderToday: {
    backgroundColor: Colors.accentGlow,
  },
  dayHeaderText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  dayHeaderDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  dayHeaderTextToday: {
    color: Colors.accent,
  },
  memberRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  memberLabel: {
    width: LABEL_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  memberRate: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
  },
  cell: {
    width: COL_WIDTH,
    padding: 3,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    gap: 3,
  },
  cellToday: {
    backgroundColor: 'rgba(0, 212, 170, 0.05)',
  },
  chip: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs + 2,
    paddingRight: 18,
  },
  timeoffChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  ootChip: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  loggedChip: {
    backgroundColor: Colors.bgElevated,
    paddingRight: Spacing.xs + 2,
  },
  chipTime: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
  },
  loggedTime: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipCost: {
    fontSize: FontSize.xxs,
    color: Colors.textSecondary,
  },
  chipNote: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
  },
  chipDelete: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDeleteText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 16,
  },
  loggedBadge: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  loggedBadgePaid: {
    color: Colors.success,
  },
  addCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  addCellText: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    width: LABEL_WIDTH + COL_WIDTH * 7,
  },
  totalsLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  totalsValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
});
