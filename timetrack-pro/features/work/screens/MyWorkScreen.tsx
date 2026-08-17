import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/auth-provider';
import { useMyTaskAssignments } from '@/features/task-lists/hooks';
import { useSopChecklist, useTodayDailySop } from '@/features/sops/hooks';
import { parseDateString, toDateString } from '@/features/schedule/lib';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** 'Aug 13' — assignments older than today read as overdue. */
function dueLabel(dateStr: string): string {
  return parseDateString(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const statusBadgeStyles: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: Colors.warning },
  in_progress: { bg: 'rgba(100,149,237,0.15)', color: '#6495ed' },
};

/**
 * Unified contractor work page: anything assigned specifically to this user
 * sits above a summary card for today's shared SOP checklist. Every checklist
 * opens on its own dedicated page — nothing renders inline here anymore.
 */
export default function MyWorkScreen() {
  const { user } = useAuth();
  const { data: assignments } = useMyTaskAssignments(user?.id ?? '');
  const today = toDateString(new Date());

  // Summary numbers for the SOP card; the dedicated page owns the details.
  const { data: todaySop } = useTodayDailySop();
  const { data: sopChecklist } = useSopChecklist(
    todaySop?.id ?? '',
    todaySop?.sop_template_id,
  );
  const sopCheckable =
    sopChecklist?.templateItems.filter((i) => i.item_type !== 'section') ?? [];
  const sopChecked = sopCheckable.filter((i) => i.checked).length;
  const sopComplete = !!todaySop?.completed_at;
  const sopSubtitle = sopComplete
    ? 'Complete ✓'
    : todaySop
      ? `${sopChecked} of ${sopCheckable.length} tasks complete`
      : "Start today's checklist";

  const active =
    assignments?.filter(
      (a: any) => a.status === 'pending' || a.status === 'in_progress',
    ) ?? [];

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        <Text style={s.heading}>My Work</Text>
        <Text style={s.subtitle}>{formatFullDate(new Date())}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {active.length > 0 && (
          <View style={s.assignedSection}>
            <View style={s.sectionHeader}>
              <View style={s.accentDot} />
              <Text style={s.sectionTitle}>Assigned to you</Text>
            </View>

            <View style={s.cardList}>
              {active.map((item: any) => {
                const badge =
                  statusBadgeStyles[item.status] ?? statusBadgeStyles.pending;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={s.card}
                    onPress={() =>
                      router.push(`/(employee)/task-checklist/${item.id}` as any)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={s.cardLeft}>
                      <Text style={s.cardTitle}>
                        {item.task_lists?.title ?? 'Task list'}
                      </Text>
                      {item.task_lists?.description ? (
                        <Text style={s.cardDesc} numberOfLines={2}>
                          {item.task_lists.description}
                        </Text>
                      ) : null}
                      <View style={s.badgeRow}>
                        <View style={[s.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[s.badgeText, { color: badge.color }]}>
                            {item.status === 'in_progress'
                              ? 'In Progress'
                              : item.status}
                          </Text>
                        </View>
                        {item.due_date ? (
                          <View
                            style={[
                              s.badge,
                              {
                                backgroundColor:
                                  item.due_date < today
                                    ? 'rgba(244,63,94,0.15)'
                                    : 'rgba(255,255,255,0.06)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                s.badgeText,
                                {
                                  color:
                                    item.due_date < today
                                      ? Colors.danger
                                      : Colors.textSecondary,
                                },
                              ]}
                            >
                              {item.due_date === today
                                ? 'Due today'
                                : `Due ${dueLabel(item.due_date)}`}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Text style={s.chevron}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={s.sectionHeader}>
          <View style={s.accentDot} />
          <Text style={s.sectionTitle}>Today's SOP</Text>
        </View>
        <TouchableOpacity
          style={s.card}
          onPress={() => router.push('/(employee)/sop-checklist' as any)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open today's SOP checklist"
        >
          <View style={s.cardLeft}>
            <Text style={s.cardTitle}>
              {todaySop?.sop_templates?.name ?? "Today's SOP"}
            </Text>
            <Text style={s.cardDesc}>{sopSubtitle}</Text>
            {todaySop && !sopComplete && sopCheckable.length > 0 ? (
              <View style={s.sopProgressTrack}>
                <View
                  style={[
                    s.sopProgressFill,
                    {
                      width: `${Math.round(
                        (sopChecked / sopCheckable.length) * 100,
                      )}%`,
                    },
                  ]}
                />
              </View>
            ) : null}
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: 0,
    paddingBottom: Spacing.xxl,
  },
  assignedSection: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  cardList: {
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  cardDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: Spacing.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  chevron: {
    fontSize: FontSize.xl,
    color: Colors.textMuted,
  },
  sopProgressTrack: {
    height: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  sopProgressFill: {
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
  },
});
