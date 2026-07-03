import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/auth-provider';
import { useMyTaskAssignments } from '@/features/task-lists/hooks';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

const statusBadgeStyles: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: Colors.warning },
  in_progress: { bg: 'rgba(100,149,237,0.15)', color: '#6495ed' },
  completed: { bg: 'rgba(16,185,129,0.15)', color: Colors.success },
};

export default function TasksScreen() {
  const { user } = useAuth();
  const { data: assignments, isLoading, refetch } = useMyTaskAssignments(user?.id ?? '');

  const pending =
    assignments?.filter(
      (a: any) => a.status === 'pending' || a.status === 'in_progress',
    ) ?? [];
  const completed =
    assignments?.filter((a: any) => a.status === 'completed') ?? [];

  const handleCardPress = (assignmentId: string) => {
    router.push(`/(employee)/task-checklist/${assignmentId}` as any);
  };

  const renderAssignmentCard = (item: any, isCompleted: boolean) => {
    const badge = statusBadgeStyles[item.status] ?? statusBadgeStyles.pending;
    return (
      <TouchableOpacity
        key={item.id}
        style={[s.card, isCompleted && s.cardCompleted]}
        onPress={() => handleCardPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={s.cardLeft}>
          <Text style={s.cardTitle}>{item.task_lists?.title ?? 'Task'}</Text>
          {item.task_lists?.description ? (
            <Text style={s.cardDesc} numberOfLines={2}>
              {item.task_lists.description}
            </Text>
          ) : null}
          <View style={[s.badge, { backgroundColor: badge.bg }]}>
            <Text style={[s.badgeText, { color: badge.color }]}>
              {item.status === 'in_progress' ? 'In Progress' : item.status}
            </Text>
          </View>
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        <Text style={s.heading}>My Tasks</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Pending Tasks */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.accentDot} />
            <Text style={s.sectionTitle}>Pending Tasks</Text>
          </View>
          {pending.length > 0 ? (
            <View style={s.cardList}>
              {pending.map((item: any) => renderAssignmentCard(item, false))}
            </View>
          ) : (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>✓</Text>
              <Text style={s.emptyTitle}>No pending tasks</Text>
              <Text style={s.emptyDesc}>You're all caught up!</Text>
            </View>
          )}
        </View>

        {/* Completed Tasks */}
        <View style={[s.section, { marginTop: Spacing.xl }]}>
          <View style={s.sectionHeader}>
            <View style={s.accentDot} />
            <Text style={s.sectionTitle}>Completed Tasks</Text>
          </View>
          {completed.length > 0 ? (
            <View style={s.cardList}>
              {completed.map((item: any) => renderAssignmentCard(item, true))}
            </View>
          ) : (
            <Text style={s.noItemsText}>No completed tasks yet.</Text>
          )}
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
  header: {
    padding: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: 0,
    paddingBottom: Spacing.xxl,
  },

  // Section
  section: {},
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

  // Cards
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
  cardCompleted: {
    opacity: 0.7,
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

  // Empty states
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 32,
    color: Colors.accent,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  noItemsText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    paddingVertical: Spacing.md,
  },
});
