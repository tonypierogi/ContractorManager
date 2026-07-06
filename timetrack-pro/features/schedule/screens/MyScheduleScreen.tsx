import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import { parseShiftType, type ScheduledShift } from '../api';
import { useMySchedule, useScheduleRange } from '../hooks';
import {
  addDays,
  calcShiftHours,
  formatEndTime,
  formatEndTimeShort,
  formatScheduleTime,
  formatScheduleTimeShort,
  getShiftTypeLabel,
  isSameDay,
  toDateString,
} from '../lib';
import ScheduleToolbar from '../components/ScheduleToolbar';

const DAY_NAMES_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MyScheduleScreen() {
  const { user, profile } = useAuth();
  const range = useScheduleRange();

  const { data: shifts } = useMySchedule(user?.id, {
    startDate: toDateString(range.start),
    endDate: toDateString(range.end),
  });
  const myShifts = shifts ?? [];
  const myRate = profile?.hourly_rate || 0;

  const todayStr = toDateString(new Date());
  const upcoming = useMemo(
    () => myShifts.filter((s) => s.shift_date >= todayStr),
    [myShifts, todayStr],
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>My Schedule</Text>

        <View style={styles.panel}>
          <ScheduleToolbar
            viewMode={range.viewMode}
            label={range.label}
            onSetViewMode={range.setViewMode}
            onPrev={range.goPrev}
            onNext={range.goNext}
            onToday={range.goToday}
          />
        </View>

        {range.viewMode === 'week' ? (
          <View style={styles.panel}>
            <WeekAgenda
              weekStart={range.weekStart}
              shifts={myShifts}
              rate={myRate}
            />
          </View>
        ) : (
          <>
            <View style={styles.panel}>
              <MonthGrid
                year={range.year}
                month={range.month}
                shifts={myShifts}
                rate={myRate}
              />
            </View>
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Upcoming Shifts</Text>
              {upcoming.length === 0 ? (
                <Text style={styles.noShifts}>No shifts</Text>
              ) : (
                upcoming.map((shift) => (
                  <UpcomingRow key={shift.id} shift={shift} rate={myRate} />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Week agenda (all 7 days rendered even if empty) ----

function WeekAgenda({
  weekStart,
  shifts,
  rate,
}: {
  weekStart: Date;
  shifts: ScheduledShift[];
  rate: number;
}) {
  if (shifts.length === 0) {
    return <EmptyState icon="📅" title="No shifts scheduled this week" />;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const grouped = new Map<string, ScheduledShift[]>();
  shifts.forEach((s) => {
    const list = grouped.get(s.shift_date) ?? [];
    list.push(s);
    grouped.set(s.shift_date, list);
  });

  return (
    <View>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i);
        const dateStr = toDateString(d);
        const isToday = isSameDay(d, today);
        const dayShifts = grouped.get(dateStr) ?? [];

        return (
          <View key={dateStr} style={styles.dayBlock}>
            <Text style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
              {DAY_NAMES_LONG[d.getDay()]},{' '}
              {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {isToday ? ' · Today' : ''}
            </Text>
            {dayShifts.length === 0 ? (
              <Text style={styles.noShifts}>No shifts</Text>
            ) : (
              dayShifts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} rate={rate} />
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}

function ShiftCard({ shift, rate }: { shift: ScheduledShift; rate: number }) {
  const decoded = parseShiftType(shift.note);

  if (decoded.type !== 'shift') {
    const isOOT = decoded.type === 'out_of_town';
    return (
      <View style={[styles.card, isOOT ? styles.ootCard : styles.timeoffCard]}>
        <Text
          style={[styles.cardTime, { color: isOOT ? '#3b82f6' : Colors.warning }]}
        >
          {isOOT ? '✈' : '🏖'} {getShiftTypeLabel(decoded.type)}
        </Text>
        <Text style={styles.cardSub}>{decoded.note || 'All day'}</Text>
      </View>
    );
  }

  const hours = calcShiftHours(shift.start_time, shift.end_time);
  const cost = hours * rate;
  return (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        <Text style={styles.cardTime}>
          {formatScheduleTime(shift.start_time)} –{' '}
          {formatEndTime(shift.start_time, shift.end_time)}
        </Text>
        <Text style={styles.cardSub}>
          {hours.toFixed(1)} hours
          {rate ? ` · ${formatCurrency(cost)}` : ''}
        </Text>
      </View>
      {decoded.note ? (
        <Text style={styles.cardNote} numberOfLines={2}>
          {decoded.note}
        </Text>
      ) : null}
    </View>
  );
}

// ---- Month grid (renders ALL pills — parity with legacy employee view) ----

function MonthGrid({
  year,
  month,
  shifts,
  rate,
}: {
  year: number;
  month: number;
  shifts: ScheduledShift[];
  rate: number;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    const dayShifts = shifts.filter((s) => s.shift_date === dateStr);

    const cell = (
      <View
        key={dateStr}
        style={[
          styles.monthDay,
          !isCurrentMonth && styles.otherMonth,
          isToday && styles.monthToday,
        ]}
      >
        <Text style={styles.monthDayNum}>{d.getDate()}</Text>
        {dayShifts.map((shift) => {
          const decoded = parseShiftType(shift.note);
          if (decoded.type !== 'shift') {
            const isOOT = decoded.type === 'out_of_town';
            return (
              <View
                key={shift.id}
                style={[styles.pill, isOOT ? styles.ootPill : styles.timeoffPill]}
              >
                <Text style={styles.pillMuted} numberOfLines={1}>
                  {isOOT ? '✈' : '🏖'} {getShiftTypeLabel(decoded.type)}
                </Text>
              </View>
            );
          }
          const cost = calcShiftHours(shift.start_time, shift.end_time) * rate;
          return (
            <View key={shift.id} style={[styles.pill, styles.tealPill]}>
              <Text style={styles.pillTeal} numberOfLines={1}>
                {formatScheduleTimeShort(shift.start_time)}–
                {formatEndTimeShort(shift.start_time, shift.end_time)}
                {rate ? ` ${formatCurrency(cost)}` : ''}
              </Text>
              {decoded.note ? (
                <Text style={styles.pillMuted} numberOfLines={1}>
                  {decoded.note}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    );

    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push(cell);
  }

  return (
    <View>
      <View style={styles.weekdays}>
        {DAY_NAMES_SHORT.map((d) => (
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

// ---- Upcoming shifts list (under the month calendar) ----

function UpcomingRow({ shift, rate }: { shift: ScheduledShift; rate: number }) {
  const decoded = parseShiftType(shift.note);
  const d = new Date(shift.shift_date + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (decoded.type !== 'shift') {
    const isOOT = decoded.type === 'out_of_town';
    return (
      <View style={styles.upcomingRow}>
        <Text style={styles.upcomingDate}>{dateLabel}</Text>
        <View style={styles.upcomingInfo}>
          <Text
            style={[
              styles.cardTime,
              { color: isOOT ? '#3b82f6' : Colors.warning },
            ]}
          >
            {isOOT ? '✈' : '🏖'} {getShiftTypeLabel(decoded.type)}
          </Text>
          <Text style={styles.cardSub}>{decoded.note || 'All day'}</Text>
        </View>
      </View>
    );
  }

  const hours = calcShiftHours(shift.start_time, shift.end_time);
  const cost = hours * rate;
  return (
    <View style={styles.upcomingRow}>
      <Text style={styles.upcomingDate}>{dateLabel}</Text>
      <View style={styles.upcomingInfo}>
        <Text style={styles.cardTime}>
          {formatScheduleTime(shift.start_time)} –{' '}
          {formatEndTime(shift.start_time, shift.end_time)}
        </Text>
        <Text style={styles.cardSub}>
          {hours.toFixed(1)} hours
          {rate ? ` · ${formatCurrency(cost)}` : ''}
          {decoded.note ? ` · ${decoded.note}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    paddingBottom: Spacing.xl,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  dayBlock: {
    marginBottom: Spacing.md,
  },
  dayHeader: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  dayHeaderToday: {
    color: Colors.accent,
  },
  noShifts: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  timeoffCard: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 2,
  },
  ootCard: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    gap: 2,
  },
  cardMain: {
    flex: 1,
  },
  cardTime: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  cardSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardNote: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    maxWidth: 120,
    textAlign: 'right',
  },
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
  monthDay: {
    flex: 1,
    minHeight: 72,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 2,
    gap: 2,
  },
  otherMonth: {
    opacity: 0.45,
  },
  monthToday: {
    backgroundColor: 'rgba(0, 212, 170, 0.06)',
  },
  monthDayNum: {
    fontSize: FontSize.xxs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  pill: {
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  tealPill: {
    backgroundColor: 'rgba(0, 212, 170, 0.12)',
  },
  timeoffPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  ootPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  pillTeal: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.accent,
  },
  pillMuted: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  upcomingDate: {
    width: 92,
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  upcomingInfo: {
    flex: 1,
  },
});
