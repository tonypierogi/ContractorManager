import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/auth-provider';
import { useTodayStats } from '@/features/timeclock/hooks';
import { useMySchedule } from '@/features/schedule/hooks';
import { parseShiftType } from '@/features/schedule/api';
import {
  addDays,
  formatEndTime,
  formatScheduleTime,
  parseDateString,
  toDateString,
} from '@/features/schedule/lib';
import { isProfileIncomplete } from '@/features/profile/utils';
import { formatCurrency } from '@/utils/format';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadows } from '@/constants/theme';

/**
 * Personal hub: everything about *you* (profile, invoices, shifts, schedule)
 * behind one nav destination. Each row is a preview that drills into the
 * existing full page.
 */
export default function MyPageScreen() {
  const { user, profile } = useAuth();
  const { data: todayStats } = useTodayStats(user?.id ?? '');

  const scheduleRange = useMemo(() => {
    const today = new Date();
    return {
      startDate: toDateString(today),
      endDate: toDateString(addDays(today, 14)),
    };
  }, []);
  const { data: upcoming } = useMySchedule(user?.id, scheduleRange);

  const nextShift = (upcoming ?? []).find(
    (shift) => parseShiftType(shift.note).type === 'shift',
  );
  const nextShiftLabel = nextShift
    ? `Next: ${parseDateString(nextShift.shift_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })} · ${formatScheduleTime(nextShift.start_time)} – ${formatEndTime(
        nextShift.start_time,
        nextShift.end_time,
      )}`
    : 'No upcoming shifts scheduled';

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    'Your profile';
  const incomplete = !profile || isProfileIncomplete(profile);
  const todayHours = todayStats?.totalHours ?? 0;

  const rows: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    sub: string;
    href: string;
  }[] = [
    {
      icon: 'calendar-clear-outline',
      label: 'My Schedule',
      sub: nextShiftLabel,
      href: '/(employee)/schedule',
    },
    {
      icon: 'calendar-outline',
      label: 'Shifts',
      sub:
        todayHours > 0
          ? `${todayHours.toFixed(1)} hours logged today`
          : 'Hours worked & past shifts',
      href: '/(employee)/shifts',
    },
    {
      icon: 'document-text-outline',
      label: 'Invoices',
      sub: 'Your invoices & payments',
      href: '/(employee)/invoices',
    },
  ];

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.heading}>My Page</Text>

        {/* Profile card */}
        <TouchableOpacity
          style={s.profileCard}
          onPress={() => router.push('/(employee)/profile' as any)}
          activeOpacity={0.7}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {`${(profile?.first_name || '?')[0]}${(profile?.last_name || '')[0] || ''}`.toUpperCase()}
            </Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{fullName}</Text>
            {profile?.email ? <Text style={s.profileEmail}>{profile.email}</Text> : null}
            {incomplete ? (
              <View style={s.warnBadge}>
                <Text style={s.warnBadgeText}>Complete your profile</Text>
              </View>
            ) : profile?.hourly_rate ? (
              <Text style={s.rateText}>{formatCurrency(profile.hourly_rate)}/hr</Text>
            ) : null}
          </View>
          <View style={s.editHint}>
            <Text style={s.editHintText}>Edit</Text>
            <Text style={s.chevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Drill-in rows */}
        <View style={s.panel}>
          {rows.map((row, idx) => (
            <TouchableOpacity
              key={row.href}
              style={[s.row, idx < rows.length - 1 && s.rowBorder]}
              onPress={() => router.push(row.href as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={row.icon} size={20} color={Colors.accent} />
              <View style={s.rowBody}>
                <Text style={s.rowLabel}>{row.label}</Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {row.sub}
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  heading: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  profileEmail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rateText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent,
    marginTop: Spacing.xs,
  },
  warnBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: BorderRadius.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: Spacing.xs,
  },
  warnBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.warning,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  editHintText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: FontWeight.medium,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  rowSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: FontSize.xl,
    color: Colors.textMuted,
  },
});
