import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/features/auth/auth-provider';
import {
  useSopTemplates,
  useDeleteSopTemplate,
  useDuplicateSopTemplate,
  useCompletedDailySops,
} from '@/features/sops/hooks';
import {
  useTaskLists,
  useDeleteTaskList,
  useDuplicateTaskList,
} from '@/features/task-lists/hooks';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatDate } from '@/utils/format';
import type { SopTemplate } from '@/types/database';

type WorkTab = 'tasks' | 'sops';

/**
 * The Work hub: one place for both template systems until the full
 * SOP/task-list merge lands (docs/flow-redesign-spec.md). Two sub-pages —
 * Task Lists and SOPs — each with search, create-blank, and
 * create-by-duplicating-a-template.
 */
export default function AdminWorkScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<WorkTab>(params.tab === 'sops' ? 'sops' : 'tasks');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { user } = useAuth();
  const { data: taskLists, isLoading: tasksLoading } = useTaskLists();
  const { data: sopTemplates, isLoading: sopsLoading } = useSopTemplates();
  const { data: completedSops } = useCompletedDailySops();
  const deleteTaskList = useDeleteTaskList();
  const duplicateTaskList = useDuplicateTaskList();
  const deleteSop = useDeleteSopTemplate();
  const duplicateSop = useDuplicateSopTemplate();

  const query = search.trim().toLowerCase();

  const filteredTaskLists = useMemo(() => {
    const lists = (taskLists ?? []) as any[];
    if (!query) return lists;
    return lists.filter((t) => t.title?.toLowerCase().includes(query));
  }, [taskLists, query]);

  const filteredSops = useMemo(() => {
    const sops = (sopTemplates ?? []) as SopTemplate[];
    if (!query) return sops;
    return sops.filter((s) => s.name?.toLowerCase().includes(query));
  }, [sopTemplates, query]);

  // Duplicate-and-edit: land in the editor on the fresh copy.
  const handleDuplicateTaskList = useCallback(
    async (id: string) => {
      setCreateOpen(false);
      try {
        const newId = await duplicateTaskList.mutateAsync({ id, createdBy: user?.id ?? '' });
        router.push(`/(admin)/task-lists/editor?id=${newId}` as any);
      } catch {
        Alert.alert('Error', 'Failed to duplicate task list');
      }
    },
    [duplicateTaskList, user?.id],
  );

  const handleDuplicateSop = useCallback(
    async (id: string) => {
      setCreateOpen(false);
      try {
        const newId = await duplicateSop.mutateAsync(id);
        router.push(`/(admin)/sops/editor?id=${newId}` as any);
      } catch {
        Alert.alert('Error', 'Failed to duplicate SOP');
      }
    },
    [duplicateSop],
  );

  const confirmDelete = (kind: WorkTab, id: string, name: string) => {
    Alert.alert(
      kind === 'sops' ? 'Delete SOP' : 'Delete Task List',
      `Delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            kind === 'sops' ? deleteSop.mutate(id) : deleteTaskList.mutate(id),
        },
      ],
    );
  };

  const startBlank = () => {
    setCreateOpen(false);
    router.push(
      (tab === 'sops' ? '/(admin)/sops/editor' : '/(admin)/task-lists/editor') as any,
    );
  };

  const iconAction = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    danger = false,
  ) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      style={styles.iconAction}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={17}
        color={danger ? Colors.danger : Colors.textSecondary}
      />
    </TouchableOpacity>
  );

  const renderTaskListCard = (item: any) => {
    const itemCount = item.task_list_items?.length ?? 0;
    const assignmentCount = item.task_list_assignments?.length ?? 0;
    const completedCount =
      item.task_list_assignments?.filter((a: any) => a.status === 'completed').length ?? 0;
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => router.push(`/(admin)/task-lists/${item.id}` as any)}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="list-outline" size={20} color={Colors.accent} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.is_sop ? (
              <View style={styles.sopBadge}>
                <Text style={styles.sopBadgeText}>SOP</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardMeta}>
            {itemCount} {itemCount === 1 ? 'task' : 'tasks'}
            {'  ·  '}
            {assignmentCount} assigned
            {'  ·  '}
            {completedCount} completed
            {item.source_video_url ? '  ·  video' : ''}
          </Text>
        </View>
        <View style={styles.cardActions}>
          {iconAction('person-add-outline', 'Assign', () =>
            router.push(`/(admin)/task-lists/${item.id}?assign=true` as any),
          )}
          {iconAction('pencil-outline', 'Edit', () =>
            router.push(`/(admin)/task-lists/editor?id=${item.id}` as any),
          )}
          {iconAction('copy-outline', 'Duplicate', () => handleDuplicateTaskList(item.id))}
          {iconAction('trash-outline', 'Delete', () =>
            confirmDelete('tasks', item.id, item.title), true)}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSopCard = (item: SopTemplate) => (
    <TouchableOpacity
      key={item.id}
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/(admin)/sops/editor?id=${item.id}` as any)}
    >
      <View style={styles.cardIcon}>
        <Ionicons name="clipboard-outline" size={20} color={Colors.accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        {item.description ? (
          <Text style={styles.cardMeta} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <View style={styles.cardActions}>
        {iconAction('pencil-outline', 'Edit', () =>
          router.push(`/(admin)/sops/editor?id=${item.id}` as any),
        )}
        {iconAction('copy-outline', 'Duplicate', () => handleDuplicateSop(item.id))}
        {iconAction('trash-outline', 'Delete', () =>
          confirmDelete('sops', item.id, item.name), true)}
      </View>
    </TouchableOpacity>
  );

  const isLoading = tab === 'tasks' ? tasksLoading : sopsLoading;
  const listEmpty = tab === 'tasks' ? filteredTaskLists.length === 0 : filteredSops.length === 0;
  const templates = tab === 'tasks' ? filteredTaskLists : filteredSops;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Work</Text>
        <Button
          title={tab === 'sops' ? 'New SOP' : 'New Task List'}
          size="sm"
          icon={<Ionicons name="add" size={16} color={Colors.bgPrimary} />}
          onPress={() => setCreateOpen(true)}
        />
      </View>

      {/* Sub-page tabs */}
      <View style={styles.tabs}>
        {(
          [
            { key: 'tasks', label: 'Task Lists', icon: 'list-outline', count: taskLists?.length ?? 0 },
            { key: 'sops', label: 'SOPs', icon: 'clipboard-outline', count: sopTemplates?.length ?? 0 },
          ] as { key: WorkTab; label: string; icon: keyof typeof Ionicons.glyphMap; count: number }[]
        ).map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={t.icon}
                size={15}
                color={active ? Colors.accent : Colors.textSecondary}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t.label}
              </Text>
              <View style={[styles.countPill, active && styles.countPillActive]}>
                <Text style={[styles.countPillText, active && styles.countPillTextActive]}>
                  {t.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={tab === 'sops' ? 'Search SOPs…' : 'Search task lists…'}
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!listEmpty ? (
          <View style={styles.cardList}>
            {tab === 'tasks'
              ? filteredTaskLists.map(renderTaskListCard)
              : filteredSops.map(renderSopCard)}
          </View>
        ) : !isLoading ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={tab === 'sops' ? 'clipboard-outline' : 'list-outline'}
              size={32}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {query
                ? 'No matches'
                : tab === 'sops'
                  ? 'No SOPs yet'
                  : 'No task lists yet'}
            </Text>
            <Text style={styles.emptyDesc}>
              {query
                ? 'Try a different search.'
                : 'Create one from scratch or duplicate a template.'}
            </Text>
            {!query && (
              <View style={{ marginTop: Spacing.lg }}>
                <Button
                  title={tab === 'sops' ? 'Create SOP' : 'Create Task List'}
                  onPress={() => setCreateOpen(true)}
                />
              </View>
            )}
          </View>
        ) : null}

        {/* Completed daily checklists live with SOPs */}
        {tab === 'sops' && (
          <View style={styles.completedPanel}>
            <View style={styles.sectionHeader}>
              <View style={styles.accentDot} />
              <Text style={styles.sectionTitle}>Completed Checklists</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Daily checklists that have been fully completed.
            </Text>
            {completedSops && completedSops.length > 0 ? (
              completedSops.map((sop: any) => {
                const sopName = sop.sop_templates?.name ?? 'Checklist';
                const completedDate = sop.completed_at
                  ? new Date(sop.completed_at).toLocaleString()
                  : '';
                return (
                  <View key={sop.id} style={styles.completedRow}>
                    <View style={styles.completedInfo}>
                      <Text style={styles.completedName}>{sopName}</Text>
                      <Text style={styles.completedMeta}>
                        {formatDate(sop.date)}
                        {completedDate ? `  Completed ${completedDate}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.completedEmpty}>No completed checklists yet.</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Create: blank or duplicate a template */}
      <Modal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tab === 'sops' ? 'New SOP' : 'New Task List'}
      >
        <TouchableOpacity style={styles.createOption} onPress={startBlank} activeOpacity={0.7}>
          <View style={styles.createOptionIcon}>
            <Ionicons name="add" size={20} color={Colors.accent} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.createOptionTitle}>Start blank</Text>
            <Text style={styles.cardMeta}>Build it from scratch in the editor.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        {templates.length > 0 && (
          <>
            <Text style={styles.createDivider}>Or duplicate a template</Text>
            {templates.map((t: any) => (
              <TouchableOpacity
                key={t.id}
                style={styles.createOption}
                activeOpacity={0.7}
                onPress={() =>
                  tab === 'sops' ? handleDuplicateSop(t.id) : handleDuplicateTaskList(t.id)
                }
              >
                <View style={styles.createOptionIcon}>
                  <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.createOptionTitle} numberOfLines={1}>
                    {tab === 'sops' ? t.name : t.title}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  tabLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.accent,
  },
  countPill: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  countPillActive: {
    backgroundColor: Colors.accent,
  },
  countPillText: {
    fontSize: FontSize.xxs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  countPillTextActive: {
    color: Colors.bgPrimary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    minHeight: 42,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  cardList: {
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  sopBadge: {
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
  },
  sopBadgeText: {
    fontSize: FontSize.xxs,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  cardMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 2,
    flexShrink: 0,
  },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  completedPanel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  completedInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  completedName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  completedMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  completedEmpty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    padding: Spacing.xl,
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  createOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createOptionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  createDivider: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
});
