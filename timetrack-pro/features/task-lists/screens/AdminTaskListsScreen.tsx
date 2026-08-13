import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Button from '@/components/ui/Button';
import {
  useTaskLists,
  useDeleteTaskList,
  useDuplicateTaskList,
} from '@/features/task-lists/hooks';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

type FilterTab = 'all' | 'sop' | 'task';

export default function TaskListsScreen() {
  const { data: taskLists, isLoading } = useTaskLists();
  const { user } = useAuth();
  const deleteTaskList = useDeleteTaskList();
  const duplicateTaskList = useDuplicateTaskList();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filteredLists = useMemo(() => {
    if (!taskLists) return [];
    if (activeFilter === 'sop') return taskLists.filter((t: any) => t.is_sop);
    if (activeFilter === 'task') return taskLists.filter((t: any) => !t.is_sop);
    return taskLists;
  }, [taskLists, activeFilter]);

  const handleDelete = useCallback(
    (id: string, title: string) => {
      Alert.alert('Delete Task List', `Are you sure you want to delete "${title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTaskList.mutate(id),
        },
      ]);
    },
    [deleteTaskList],
  );

  // Land in the editor on the fresh copy so tweak-and-reassign is one flow.
  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        const newId = await duplicateTaskList.mutateAsync({
          id,
          createdBy: user?.id ?? '',
        });
        router.push(`/(admin)/task-lists/editor?id=${newId}` as any);
      } catch {
        Alert.alert('Error', 'Failed to duplicate task list');
      }
    },
    [duplicateTaskList, user?.id],
  );

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sop', label: 'SOPs Only' },
    { key: 'task', label: 'Tasks Only' },
  ];

  const renderCard = (item: any) => {
    const itemCount = item.task_list_items?.length ?? 0;
    const assignmentCount = item.task_list_assignments?.length ?? 0;
    const completedCount =
      item.task_list_assignments?.filter((a: any) => a.status === 'completed').length ?? 0;
    const isSop = item.is_sop;
    const hasVideo = item.video_url || item.task_list_items?.some((i: any) => i.video_url);

    return (
      <View key={item.id} style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[s.typeBadge, isSop ? s.sopBadge : s.taskBadge]}>
            <Text style={[s.typeBadgeText, isSop ? s.sopBadgeText : s.taskBadgeText]}>
              {isSop ? 'SOP' : 'TASK'}
            </Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <Text style={s.statText}>{itemCount} tasks</Text>
          <Text style={s.statText}>{assignmentCount} assigned</Text>
          <Text style={s.statText}>{completedCount} completed</Text>
          {hasVideo && <Text style={s.videoIndicator}>Has video</Text>}
        </View>

        <View style={s.actionsRow}>
          <Button
            title="View"
            variant="ghost"
            size="sm"
            onPress={() => router.push(`/(admin)/task-lists/${item.id}`)}
          />
          <Button
            title="Assign"
            variant="secondary"
            size="sm"
            onPress={() => router.push(`/(admin)/task-lists/${item.id}?assign=true` as any)}
          />
          <Button
            title="Edit"
            variant="secondary"
            size="sm"
            onPress={() => router.push(`/(admin)/task-lists/editor?id=${item.id}` as any)}
          />
          <Button
            title="Duplicate"
            variant="secondary"
            size="sm"
            onPress={() => handleDuplicate(item.id)}
          />
          <Button
            title="Delete"
            variant="danger"
            size="sm"
            onPress={() => handleDelete(item.id, item.title)}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        <Text style={s.heading}>Task Lists</Text>
        <Button
          title="+ Create Task List"
          size="sm"
          onPress={() => router.push('/(admin)/task-lists/editor')}
        />
      </View>

      <View style={s.panelContainer}>
        {/* Filter Tabs */}
        <View style={s.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterTab, activeFilter === f.key && s.filterTabActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.filterTabText,
                  activeFilter === f.key && s.filterTabTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Task List Cards */}
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {filteredLists.length > 0 ? (
            <View style={s.cardList}>
              {filteredLists.map((item: any) => renderCard(item))}
            </View>
          ) : !isLoading ? (
            <View style={s.emptyState}>
              <Text style={s.emptyTitle}>No Task Lists Yet</Text>
              <Text style={s.emptyDesc}>
                Create your first task list to get started.
              </Text>
              <View style={{ marginTop: Spacing.lg }}>
                <Button
                  title="Create Task List"
                  onPress={() => router.push('/(admin)/task-lists/editor')}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  panelContainer: {
    flex: 1,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterTab: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
  },
  filterTabActive: {
    backgroundColor: Colors.accent,
  },
  filterTabText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.bgPrimary,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  cardList: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  typeBadge: {
    borderRadius: BorderRadius.sm,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
  },
  sopBadge: {
    backgroundColor: 'rgba(0,212,170,0.15)',
  },
  taskBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
  },
  typeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sopBadgeText: {
    color: Colors.accent,
  },
  taskBadgeText: {
    color: Colors.warning,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  statText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  videoIndicator: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
