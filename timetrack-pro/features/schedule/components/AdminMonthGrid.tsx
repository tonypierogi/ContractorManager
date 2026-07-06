import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import type { Profile } from '@/types/database';
import { parseShiftType, type ScheduledShift } from '../api';
import {
  calcShiftHours,
  formatScheduleTimeShort,
  getShiftTypeLabel,
  isSameDay,
  memberShortName,
  toDateString,
  type LoggedDisplayShift,
} from '../lib';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_PILLS = 3; // parity: cap at 3 pills + '+N more', no expansion

interface AdminMonthGridProps {
  year: number;
  month: number;
  members: Profile[]; // full sorted list
  hiddenMembers: Set<string>;
  shifts: ScheduledShift[];
  logged: LoggedDisplayShift[];
  typeFilter: 'both' | 'scheduled' | 'logged';
  colorFor: (memberId: string) => string;
  onAdd: (dateStr: string) => void;
  onEdit: (shift: ScheduledShift) => void;
  onDelete: (id: string) => void;
}

type Pill =
  | { kind: 'scheduled'; shift: ScheduledShift }
  | { kind: 'logged'; shift: LoggedDisplayShift };

export default function AdminMonthGrid({
  year,
  month,
  members,
  hiddenMembers,
  shifts,
  logged,
  typeFilter,
  colorFor,
  onAdd,
  onEdit,
  onDelete,
}: AdminMonthGridProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nameById = new Map<string, string>();
  const rateById = new Map<string, number>();
  members.forEach((m) => {
    nameById.set(m.id, memberShortName(m));
    rateById.set(m.id, m.hourly_rate || 0);
  });

  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

  const weeks: React.ReactNode[][] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - startDay + i);
    const dateStr = toDateString(d);
    const isCurrentMonth = d.getMonth() === month;
    const isToday = isSameDay(d, today);

    const scheduledDay =
      typeFilter !== 'logged'
        ? shifts.filter(
            (s) => s.shift_date === dateStr && !hiddenMembers.has(s.employee_id),
          )
        : [];
    const loggedDay =
      typeFilter !== 'scheduled'
        ? logged.filter(
            (s) => s.shift_date === dateStr && !hiddenMembers.has(s.employee_id),
          )
        : [];
    const allPills: Pill[] = [
      ...scheduledDay.map((shift): Pill => ({ kind: 'scheduled', shift })),
      ...loggedDay.map((shift): Pill => ({ kind: 'logged', shift })),
    ];

    const cell = (
      <View
        key={dateStr}
        style={[
          styles.day,
          !isCurrentMonth && styles.otherMonth,
          isToday && styles.today,
        ]}
      >
        <Text style={[styles.dayNum, !isCurrentMonth && styles.dayNumOther]}>
          {d.getDate()}
        </Text>
        {allPills.slice(0, MAX_PILLS).map((pill) => {
          if (pill.kind === 'scheduled') {
            const shift = pill.shift;
            const decoded = parseShiftType(shift.note);
            const name = nameById.get(shift.employee_id) || '';

            if (decoded.type !== 'shift') {
              const isOOT = decoded.type === 'out_of_town';
              return (
                <TouchableOpacity
                  key={`s-${shift.id}`}
                  style={[styles.pill, isOOT ? styles.ootPill : styles.timeoffPill]}
                  onPress={() => onEdit(shift)}
                  onLongPress={() => onDelete(shift.id)}
                >
                  <Text style={styles.pillText} numberOfLines={1}>
                    {isOOT ? '✈' : '🏖'} {name || getShiftTypeLabel(decoded.type)}
                  </Text>
                </TouchableOpacity>
              );
            }

            const color = colorFor(shift.employee_id);
            const rate = rateById.get(shift.employee_id) || 0;
            const cost = calcShiftHours(shift.start_time, shift.end_time) * rate;
            return (
              <TouchableOpacity
                key={`s-${shift.id}`}
                style={[styles.pill, { backgroundColor: color + '22' }]}
                onPress={() => onEdit(shift)}
                onLongPress={() => onDelete(shift.id)}
              >
                <Text style={[styles.pillText, { color }]} numberOfLines={1}>
                  {formatScheduleTimeShort(shift.start_time)} {name}
                  {rate ? ` ${formatCurrency(cost)}` : ''}
                </Text>
              </TouchableOpacity>
            );
          }

          const shift = pill.shift;
          const name = nameById.get(shift.employee_id) || '';
          return (
            <View key={`l-${shift.id}`} style={[styles.pill, styles.loggedPill]}>
              <Text style={styles.loggedPillText} numberOfLines={1}>
                {formatScheduleTimeShort(shift.start_time)} {name}{' '}
                <Text style={shift.paid ? styles.paidMark : styles.unpaidMark}>
                  {shift.paid ? '✓' : '○'}
                </Text>
              </Text>
            </View>
          );
        })}
        {allPills.length > MAX_PILLS && (
          <Text style={styles.moreText}>+{allPills.length - MAX_PILLS} more</Text>
        )}
        {isCurrentMonth && (
          <TouchableOpacity style={styles.addLink} onPress={() => onAdd(dateStr)}>
            <Text style={styles.addLinkText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );

    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push(cell);
  }

  return (
    <View>
      <View style={styles.weekdays}>
        {DAY_NAMES.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((cells, i) => (
        <View key={i} style={styles.weekRow}>
          {cells}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  weekdays: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
  },
  day: {
    flex: 1,
    minHeight: 86,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 2,
    gap: 2,
  },
  otherMonth: {
    opacity: 0.45,
  },
  today: {
    backgroundColor: 'rgba(0, 212, 170, 0.06)',
  },
  dayNum: {
    fontSize: FontSize.xxs,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 1,
  },
  dayNumOther: {
    color: Colors.textMuted,
  },
  pill: {
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '600',
  },
  timeoffPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  ootPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  loggedPill: {
    backgroundColor: Colors.bgElevated,
  },
  loggedPillText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  paidMark: {
    color: Colors.success,
  },
  unpaidMark: {
    color: Colors.textMuted,
  },
  moreText: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  addLink: {
    marginTop: 'auto',
    paddingVertical: 2,
    alignItems: 'center',
  },
  addLinkText: {
    fontSize: 9,
    color: Colors.textMuted,
  },
});
