import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import type { Profile, TimeEntry } from '@/types/database';
import { parseShiftType, type ScheduledShift } from '../api';
import {
  calcShiftHours,
  memberDisplayName,
  memberInitials,
} from '../lib';

const NAME_COL = 190;
const NUM_COL = 96;

interface PaySummaryProps {
  displayMembers: Profile[]; // member-filter applied, hidden NOT yet removed
  shifts: ScheduledShift[];
  entries: TimeEntry[];
  hiddenMembers: Set<string>;
  periodLabel: string;
  colorFor: (memberId: string) => string;
  onToggleHidden: (memberId: string) => void;
  onShowAll: () => void;
}

/** 'Contractor Pay Estimates' — scheduled vs logged vs owed per member. */
export default function PaySummary({
  displayMembers,
  shifts,
  entries,
  hiddenMembers,
  periodLabel,
  colorFor,
  onToggleHidden,
  onShowAll,
}: PaySummaryProps) {
  if (displayMembers.length === 0) return null;

  const visibleMembers = displayMembers.filter((m) => !hiddenMembers.has(m.id));
  const hiddenCount = displayMembers.length - visibleMembers.length;

  let totalSchedHours = 0;
  let totalSchedPay = 0;
  let totalLoggedHours = 0;
  let totalLoggedPay = 0;
  let totalOwed = 0;

  const rows = visibleMembers.map((member) => {
    const rate = member.hourly_rate || 0;
    const color = colorFor(member.id);

    // Scheduled: non-time-off scheduled shifts only (legacy schedule.js:592-596)
    let schedHours = 0;
    shifts
      .filter(
        (s) =>
          s.employee_id === member.id && parseShiftType(s.note).type === 'shift',
      )
      .forEach((s) => {
        schedHours += calcShiftHours(s.start_time, s.end_time);
      });
    const schedPay = schedHours * rate;

    // Logged: completed time entries; Owed: unpaid-only hours × rate
    let loggedHours = 0;
    let unpaidHours = 0;
    entries
      .filter((e) => e.user_id === member.id)
      .forEach((e) => {
        const h =
          (new Date(e.clock_out as string).getTime() -
            new Date(e.clock_in).getTime()) /
          3600000;
        loggedHours += h;
        if (!e.paid) unpaidHours += h;
      });
    const loggedPay = loggedHours * rate;
    const owedPay = unpaidHours * rate;
    const pctLogged =
      schedHours > 0 ? (loggedHours / schedHours) * 100 : loggedHours > 0 ? 100 : 0;

    totalSchedHours += schedHours;
    totalSchedPay += schedPay;
    totalLoggedHours += loggedHours;
    totalLoggedPay += loggedPay;
    totalOwed += owedPay;

    const pctColor =
      pctLogged >= 100 ? Colors.success : pctLogged >= 50 ? Colors.warning : Colors.danger;

    return (
      <View key={member.id} style={styles.row}>
        <View style={styles.memberCol}>
          <TouchableOpacity
            hitSlop={8}
            onPress={() => onToggleHidden(member.id)}
            style={styles.eyeBtn}
          >
            <Ionicons name="eye-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
            <Text style={[styles.avatarText, { color }]}>
              {memberInitials(member)}
            </Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName} numberOfLines={1}>
              {memberDisplayName(member)}
            </Text>
            <Text style={styles.memberRate}>
              {rate ? `${formatCurrency(rate)}/hr` : 'No rate set'}
            </Text>
          </View>
        </View>
        <View style={styles.numCol}>
          <Text style={styles.hours}>{schedHours.toFixed(1)}h</Text>
          <Text style={styles.amount}>{formatCurrency(schedPay)}</Text>
        </View>
        <View style={styles.numCol}>
          <Text style={styles.hours}>{loggedHours.toFixed(1)}h</Text>
          <Text style={styles.amount}>{formatCurrency(loggedPay)}</Text>
        </View>
        <View style={styles.numCol}>
          <Text style={[styles.amount, owedPay > 0 && styles.hasOwed]}>
            {formatCurrency(owedPay)}
          </Text>
        </View>
        <View style={styles.numCol}>
          <Text style={[styles.pct, { color: pctColor }]}>
            {pctLogged.toFixed(0)}%
          </Text>
          <View style={styles.pctBar}>
            <View
              style={[
                styles.pctFill,
                { width: `${Math.min(pctLogged, 100)}%`, backgroundColor: pctColor },
              ]}
            />
          </View>
        </View>
      </View>
    );
  });

  const totalPctLogged =
    totalSchedHours > 0
      ? (totalLoggedHours / totalSchedHours) * 100
      : totalLoggedHours > 0
        ? 100
        : 0;

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="cash-outline" size={18} color={Colors.accent} />
          <Text style={styles.title}>Contractor Pay Estimates</Text>
          {hiddenCount > 0 && (
            <TouchableOpacity style={styles.showHiddenBtn} onPress={onShowAll}>
              <Text style={styles.showHiddenText}>
                {hiddenCount} hidden · Show all
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.period}>{periodLabel}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { width: NAME_COL }]}>Contractor</Text>
            <Text style={[styles.headerCell, styles.headerNum]}>Scheduled</Text>
            <Text style={[styles.headerCell, styles.headerNum]}>Logged</Text>
            <Text style={[styles.headerCell, styles.headerNum]}>Owed</Text>
            <Text style={[styles.headerCell, styles.headerNum]}>% Logged</Text>
          </View>
          {rows}
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { width: NAME_COL }]}>Totals</Text>
            <View style={styles.numCol}>
              <Text style={styles.hours}>{totalSchedHours.toFixed(1)}h</Text>
              <Text style={styles.amount}>{formatCurrency(totalSchedPay)}</Text>
            </View>
            <View style={styles.numCol}>
              <Text style={styles.hours}>{totalLoggedHours.toFixed(1)}h</Text>
              <Text style={styles.amount}>{formatCurrency(totalLoggedPay)}</Text>
            </View>
            <View style={styles.numCol}>
              <Text style={[styles.amount, totalOwed > 0 && styles.hasOwed]}>
                {formatCurrency(totalOwed)}
              </Text>
            </View>
            <View style={styles.numCol}>
              <Text style={styles.pct}>{totalPctLogged.toFixed(0)}%</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: Spacing.sm,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  showHiddenBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgElevated,
  },
  showHiddenText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '600',
  },
  period: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCell: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerNum: {
    width: NUM_COL,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  memberCol: {
    width: NAME_COL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  eyeBtn: {
    width: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.xxs,
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
  numCol: {
    width: NUM_COL,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  totalsLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  hours: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  amount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  hasOwed: {
    color: Colors.warning,
    fontWeight: '600',
  },
  pct: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  pctBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgElevated,
    marginTop: 4,
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  pctFill: {
    height: 4,
    borderRadius: 2,
  },
});
