import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import { useAuth } from '@/features/auth/auth-provider';
import { useCurrentClockIn, useClockIn, useClockOut, useTodayStats } from '@/features/timeclock/hooks';
import { useMyTaskAssignments } from '@/features/task-lists/hooks';
import { useMySchedule } from '@/features/schedule/hooks';
import { parseShiftType } from '@/features/schedule/api';
import {
  addDays,
  calcShiftHours,
  formatEndTime,
  formatScheduleTime,
  getShiftTypeLabel,
  parseDateString,
  toDateString,
} from '@/features/schedule/lib';
import { formatTime } from '@/utils/format';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadows } from '@/constants/theme';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const statusBadgeStyles: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: Colors.warning },
  in_progress: { bg: 'rgba(100,149,237,0.15)', color: '#6495ed' },
};

const QUICK_LINKS: {
  label: string;
  sub: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { label: 'Time Clock', sub: 'Clock in & out', href: '/(employee)/timeclock', icon: 'timer-outline' },
  { label: 'My Work', sub: 'Tasks & SOPs', href: '/(employee)/work', icon: 'clipboard-outline' },
  { label: 'Venue', sub: 'Items & floor plans', href: '/(employee)/venue', icon: 'business-outline' },
  { label: 'Inventory', sub: 'Counts & runs', href: '/(employee)/inventory', icon: 'cube-outline' },
];

/**
 * Employee landing page: clocked-in status up top, then anything assigned
 * (or a pointer at today's SOPs), then the next few scheduled shifts, then
 * quick links into the full Time Clock / My Work / Venue / Inventory
 * pages. Each section is a preview — the destination pages stay the source
 * of truth.
 */
export default function HomeScreen() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? '';

  const { data: currentClockIn } = useCurrentClockIn(userId);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { data: todayStats } = useTodayStats(userId);
  const { data: assignments } = useMyTaskAssignments(userId);

  const scheduleRange = useMemo(() => {
    const today = new Date();
    return {
      startDate: toDateString(today),
      endDate: toDateString(addDays(today, 7)),
    };
  }, []);
  const { data: weekShifts } = useMySchedule(user?.id, scheduleRange);

  const isClockedIn = !!currentClockIn;
  const activeAssignments = (assignments ?? []).filter(
    (a: any) => a.status === 'pending' || a.status === 'in_progress',
  );
  const upcomingShifts = weekShifts ?? [];

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleClockToggle = () => {
    if (isClockedIn && currentClockIn) {
      clockOut.mutate({ entryId: currentClockIn.id, userId });
    } else {
      // Same handoff as the Time Clock page: the shift starts with today's list.
      clockIn.mutate(userId, {
        onSuccess: () => router.push('/(employee)/work' as any),
      });
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Text style={s.heading}>
            {greetingForHour(now.getHours())}, {profile?.first_name ?? 'there'}
          </Text>
          <Text style={s.subtitle}>{dateLabel}</Text>
        </View>

        {/* Clock status */}
        <View style={[s.statusCard, isClockedIn && s.statusCardActive]}>
          <View style={s.statusLeft}>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: isClockedIn ? Colors.success : Colors.textMuted }]} />
              <Text style={[s.statusText, isClockedIn && s.statusTextActive]}>
                {isClockedIn ? 'Clocked in' : 'Not clocked in'}
              </Text>
            </View>
            <Text style={s.statusSub}>
              {isClockedIn && currentClockIn
                ? `Since ${formatTime(currentClockIn.clock_in)}`
                : (todayStats?.totalHours ?? 0) > 0
                  ? `${todayStats!.totalHours.toFixed(1)} hours logged today`
                  : 'Ready when you are'}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(employee)/timeclock' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.statusLink}>Open Time Clock ›</Text>
            </TouchableOpacity>
          </View>
          <Button
            title={isClockedIn ? 'Clock Out' : 'Clock In'}
            variant={isClockedIn ? 'secondary' : 'primary'}
            size="sm"
            onPress={handleClockToggle}
            loading={clockIn.isPending || clockOut.isPending}
          />
        </View>

        {/* My Work preview */}
        <SectionHeader
          title="My Work"
          actionLabel="View all ›"
          onAction={() => router.push('/(employee)/work' as any)}
        />
        {activeAssignments.length === 0 ? (
          <TouchableOpacity
            style={s.linkCard}
            onPress={() => router.push('/(employee)/work' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="clipboard-outline" size={20} color={Colors.accent} />
            <View style={s.linkCardBody}>
              <Text style={s.linkCardTitle}>No assigned tasks</Text>
              <Text style={s.linkCardSub}>Check today's SOPs on My Work</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.cardList}>
            {activeAssignments.slice(0, 3).map((item: any) => {
              const badge = statusBadgeStyles[item.status] ?? statusBadgeStyles.pending;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={s.taskCard}
                  onPress={() => router.push(`/(employee)/task-checklist/${item.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={s.taskCardLeft}>
                    <Text style={s.taskCardTitle}>{item.task_lists?.title ?? 'Task list'}</Text>
                    <View style={[s.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[s.badgeText, { color: badge.color }]}>
                        {item.status === 'in_progress' ? 'In Progress' : item.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.chevron}>›</Text>
                </TouchableOpacity>
              );
            })}
            {activeAssignments.length > 3 && (
              <TouchableOpacity
                onPress={() => router.push('/(employee)/work' as any)}
                activeOpacity={0.7}
              >
                <Text style={s.moreLink}>
                  +{activeAssignments.length - 3} more on My Work
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Schedule preview */}
        <SectionHeader
          title="This Week"
          actionLabel="Full schedule ›"
          onAction={() => router.push('/(employee)/schedule' as any)}
        />
        {upcomingShifts.length === 0 ? (
          <View style={s.linkCard}>
            <Ionicons name="calendar-clear-outline" size={20} color={Colors.textMuted} />
            <View style={s.linkCardBody}>
              <Text style={s.linkCardTitle}>No shifts in the next 7 days</Text>
            </View>
          </View>
        ) : (
          <View style={s.panel}>
            {upcomingShifts.slice(0, 4).map((shift, idx) => {
              const decoded = parseShiftType(shift.note);
              const d = parseDateString(shift.shift_date);
              const dayLabel = d.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              const isLast = idx === Math.min(upcomingShifts.length, 4) - 1;
              return (
                <View key={shift.id} style={[s.shiftRow, !isLast && s.shiftRowBorder]}>
                  <Text style={s.shiftDate}>{dayLabel}</Text>
                  {decoded.type !== 'shift' ? (
                    <Text style={[s.shiftTime, { color: decoded.type === 'out_of_town' ? '#3b82f6' : Colors.warning }]}>
                      {decoded.type === 'out_of_town' ? '✈' : '🏖'} {getShiftTypeLabel(decoded.type)}
                    </Text>
                  ) : (
                    <View style={s.shiftInfo}>
                      <Text style={s.shiftTime}>
                        {formatScheduleTime(shift.start_time)} – {formatEndTime(shift.start_time, shift.end_time)}
                      </Text>
                      <Text style={s.shiftSub}>
                        {calcShiftHours(shift.start_time, shift.end_time).toFixed(1)} hours
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Quick links into the full pages */}
        <SectionHeader title="Explore" />
        <View style={s.grid}>
          {QUICK_LINKS.map((link) => (
            <TouchableOpacity
              key={link.href}
              style={s.gridCard}
              onPress={() => router.push(link.href as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={link.icon} size={22} color={Colors.accent} />
              <Text style={s.gridLabel}>{link.label}</Text>
              <Text style={s.gridSub}>{link.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionHeaderLeft}>
        <View style={s.accentDot} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={s.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  statusCardActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusLeft: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  statusTextActive: {
    color: Colors.success,
  },
  statusSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statusLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent,
    marginTop: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  sectionAction: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent,
  },
  cardList: {
    gap: Spacing.sm,
  },
  taskCard: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskCardLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  taskCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: Spacing.xs,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'capitalize',
  },
  moreLink: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  linkCardBody: {
    flex: 1,
  },
  linkCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  linkCardSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: FontSize.xl,
    color: Colors.textMuted,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  shiftRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  shiftDate: {
    width: 96,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  shiftInfo: {
    flex: 1,
  },
  shiftTime: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  shiftSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gridCard: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  gridLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  gridSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
