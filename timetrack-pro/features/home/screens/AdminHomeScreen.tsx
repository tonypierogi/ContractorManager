import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import InventoryStatusBadge from '@/features/inventory/components/InventoryStatusBadge';
import { useScheduledShifts } from '@/features/schedule/hooks';
import { parseShiftType, type ScheduledShift } from '@/features/schedule/api';
import { useInventoryItems, useLatestItemChecks } from '@/features/inventory/hooks';
import { getLocationLabel } from '@/features/locations/zones';
import { useTeamMembers } from '@/features/team/hooks';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import type { Profile } from '@/types/database';

const UPCOMING_DAYS = 7;

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 'HH:MM' or 'HH:MM:SS' -> '9:00 AM' */
function formatShiftTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatDayLabel(dateStr: string, todayStr: string, tomorrowStr: string): string {
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function memberName(profile: Profile | undefined): string {
  if (!profile) return 'Unknown';
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  return name || profile.email;
}

export default function AdminHomeScreen() {
  const { startDate, endDate, todayStr, tomorrowStr } = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const end = new Date(today);
    end.setDate(end.getDate() + UPCOMING_DAYS - 1);
    const todayStr = toDateString(today);
    return {
      startDate: todayStr,
      endDate: toDateString(end),
      todayStr,
      tomorrowStr: toDateString(tomorrow),
    };
  }, []);

  const { data: shifts, isLoading: shiftsLoading } = useScheduledShifts({ startDate, endDate });
  const { data: members } = useTeamMembers({ includeInactive: true });
  const { data: items, isLoading: itemsLoading } = useInventoryItems(true);
  const { data: latestChecks } = useLatestItemChecks();

  const membersById = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const m of members ?? []) map.set(m.id, m);
    return map;
  }, [members]);

  // Shifts grouped by date, in chronological order.
  const shiftsByDay = useMemo(() => {
    const groups = new Map<string, ScheduledShift[]>();
    const sorted = [...(shifts ?? [])].sort(
      (a, b) =>
        a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time),
    );
    for (const s of sorted) {
      const list = groups.get(s.shift_date) ?? [];
      list.push(s);
      groups.set(s.shift_date, list);
    }
    return [...groups.entries()];
  }, [shifts]);

  // Items whose most recent inventory check flagged them as OUT or running low.
  const lowItems = useMemo(() => {
    if (!items || !latestChecks) return [];
    return items
      .map((item) => ({ item, check: latestChecks[item.id] }))
      .filter(({ check }) => check && (check.status === 'OUT' || check.status === 'Some'))
      .sort((a, b) => {
        if (a.check!.status === b.check!.status) return a.item.name.localeCompare(b.item.name);
        return a.check!.status === 'OUT' ? -1 : 1;
      });
  }, [items, latestChecks]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Home</Text>

        {/* Upcoming shifts */}
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Upcoming Shifts</Text>
        </View>
        {shiftsLoading ? (
          <Text style={styles.mutedText}>Loading…</Text>
        ) : shiftsByDay.length === 0 ? (
          <Card>
            <Text style={styles.mutedText}>No shifts scheduled in the next {UPCOMING_DAYS} days.</Text>
          </Card>
        ) : (
          shiftsByDay.map(([date, dayShifts]) => (
            <View key={date} style={styles.dayGroup}>
              <Text style={styles.dayLabel}>{formatDayLabel(date, todayStr, tomorrowStr)}</Text>
              <Card style={styles.dayCard} onPress={() => router.push('/(admin)/schedule')}>
                {dayShifts.map((shift, i) => {
                  const { type, note } = parseShiftType(shift.note);
                  return (
                    <View
                      key={shift.id}
                      style={[styles.shiftRow, i > 0 && styles.shiftRowBorder]}
                    >
                      <View style={styles.shiftInfo}>
                        <Text style={styles.shiftName} numberOfLines={1}>
                          {memberName(membersById.get(shift.employee_id))}
                        </Text>
                        {type === 'shift' ? (
                          <Text style={styles.shiftTime}>
                            {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                          </Text>
                        ) : null}
                        {note ? (
                          <Text style={styles.shiftNote} numberOfLines={1}>
                            {note}
                          </Text>
                        ) : null}
                      </View>
                      {type === 'time_off' && <Badge label="Time Off" variant="warning" />}
                      {type === 'out_of_town' && <Badge label="Out of Town" variant="info" />}
                    </View>
                  );
                })}
              </Card>
            </View>
          ))
        )}

        {/* Inventory needing restock */}
        <View style={[styles.sectionHeader, styles.sectionSpacer]}>
          <Ionicons name="cube-outline" size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Needs Restocking</Text>
        </View>
        {itemsLoading ? (
          <Text style={styles.mutedText}>Loading…</Text>
        ) : lowItems.length === 0 ? (
          <Card>
            <Text style={styles.mutedText}>Nothing flagged — all stocked up.</Text>
          </Card>
        ) : (
          <Card style={styles.dayCard} onPress={() => router.push('/(admin)/inventory')}>
            {lowItems.map(({ item, check }, i) => (
              <View key={item.id} style={[styles.shiftRow, i > 0 && styles.shiftRowBorder]}>
                <View style={styles.shiftInfo}>
                  <Text style={styles.shiftName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.location ? (
                    <Text style={styles.shiftNote} numberOfLines={1}>
                      {getLocationLabel(item.location)}
                    </Text>
                  ) : null}
                </View>
                <InventoryStatusBadge status={check!.status} />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    padding: Spacing.lg,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionSpacer: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  dayGroup: {
    marginBottom: Spacing.md,
  },
  dayLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  dayCard: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  shiftRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  shiftInfo: {
    flex: 1,
    minWidth: 0,
  },
  shiftName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  shiftTime: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    marginTop: 2,
  },
  shiftNote: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mutedText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
