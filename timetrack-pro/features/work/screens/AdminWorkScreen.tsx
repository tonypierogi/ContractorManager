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
  const [createSearch, setCreateSearch] = useState('');
  const [menuFor, setMenuFor] = useState<{ kind: WorkTab; id: string; name: string } | null>(
    null,
  );
  const [earlierOpen, setEarlierOpen] = useState(false);

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

  // completedSops arrives newest-first; the latest gets pinned on top of the
  // SOPs tab, the rest live in a collapsed section.
  const lastCompleted = (completedSops?.[0] ?? null) as any;
  const earlierCompleted = ((completedSops ?? []) as any[]).slice(1);

  const createQuery = createSearch.trim().toLowerCase();
  const createTaskLists = ((taskLists ?? []) as any[]).filter(
    (t) => !createQuery || t.title?.toLowerCase().includes(createQuery),
  );
  const createSops = ((sopTemplates ?? []) as SopTemplate[]).filter(
    (t) => !createQuery || t.name?.toLowerCase().includes(createQuery),
  );

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateSearch('');
  };

  // Duplicate-and-edit: land in the editor on the fresh copy.
  const handleDuplicateTaskList = useCallback(
    async (id: string) => {
      setCreateOpen(false);
      setCreateSearch('');
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
      setCreateSearch('');
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
    closeCreate();
    router.push(
      (tab === 'sops' ? '/(admin)/sops/editor' : '/(admin)/task-lists/editor') as any,
    );
  };

  const menuRow = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    danger = false,
  ) => (
    <TouchableOpacity
      key={label}
      style={styles.menuRow}
      onPress={onPress}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={18} color={danger ? Colors.danger : Colors.textSecondary} />
      <Text style={[styles.menuRowText, danger && { color: Colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderTaskListCard = (item: any) => {
    const itemCount = item.task_list_items?.length ?? 0;
    const assignmentCount = item.task_list_assignments?.length ?? 0;
    const completedCount =
      item.task_list_assignments?.filter((a: any) => a.status === 'completed').length ?? 0;
    const meta = [
      `${itemCount} ${itemCount === 1 ? 'task' : 'tasks'}`,
      assignmentCount > 0 ? `${assignmentCount} assigned` : null,
      completedCount > 0 ? `${completedCount} done` : null,
    ]
      .filter(Boolean)
      .join('  ·  ');
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
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <View style={styles.cardRight}>
          {item.is_sop ? (
            <View style={styles.sopBadge}>
              <Text style={styles.sopBadgeText}>SOP</Text>
            </View>
          ) : null}
          {item.source_video_url ? (
            <Ionicons name="videocam-outline" size={14} color={Colors.textMuted} />
          ) : null}
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => setMenuFor({ kind: 'tasks', id: item.id, name: item.title })}
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${item.title}`}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
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
      <View style={styles.cardRight}>
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setMenuFor({ kind: 'sops', id: item.id, name: item.name })}
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${item.name}`}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const isLoading = tab === 'tasks' ? tasksLoading : sopsLoading;
  const listEmpty = tab === 'tasks' ? filteredTaskLists.length === 0 : filteredSops.length === 0;

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
        {/* Most recently finished checklist stays pinned on top */}
        {tab === 'sops' && lastCompleted && (
          <View style={styles.lastCompletedCard}>
            <View style={styles.lastCompletedIcon}>
              <Ionicons name="checkmark-done" size={20} color={Colors.success} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.lastCompletedLabel}>Last completed</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {lastCompleted.sop_templates?.name ?? 'Checklist'}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {formatDate(lastCompleted.date)}
                {lastCompleted.completed_at
                  ? `  ·  ${new Date(lastCompleted.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : ''}
              </Text>
            </View>
          </View>
        )}

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

        {/* Earlier completed checklists, collapsed by default */}
        {tab === 'sops' && earlierCompleted.length > 0 && (
          <View style={styles.completedPanel}>
            <TouchableOpacity
              style={styles.completedToggle}
              onPress={() => setEarlierOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: earlierOpen }}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Completed checklists</Text>
              <View style={styles.completedToggleRight}>
                <Text style={styles.completedCount}>{earlierCompleted.length}</Text>
                <Ionicons
                  name={earlierOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={Colors.textSecondary}
                />
              </View>
            </TouchableOpacity>
            {earlierOpen &&
              earlierCompleted.map((sop: any) => {
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
                        {completedDate ? `  ·  ${completedDate}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>
        )}
      </ScrollView>

      {/* Create: blank, or start from any existing template (both kinds) */}
      <Modal
        visible={createOpen}
        onClose={closeCreate}
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

        <View style={styles.createSearchBox}>
          <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
          <TextInput
            value={createSearch}
            onChangeText={setCreateSearch}
            placeholder="Search templates…"
            placeholderTextColor={Colors.textMuted}
            style={styles.createSearchInput}
          />
          {createSearch.length > 0 && (
            <TouchableOpacity
              onPress={() => setCreateSearch('')}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {(tab === 'sops'
          ? [
              { label: 'Duplicate an SOP', kind: 'sops' as const, items: createSops },
              { label: 'Duplicate a task list', kind: 'tasks' as const, items: createTaskLists },
            ]
          : [
              { label: 'Duplicate a task list', kind: 'tasks' as const, items: createTaskLists },
              { label: 'Duplicate an SOP', kind: 'sops' as const, items: createSops },
            ]
        ).map(
          (section) =>
            section.items.length > 0 && (
              <View key={section.kind}>
                <Text style={styles.createDivider}>{section.label}</Text>
                {section.items.map((t: any) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.createOption}
                    activeOpacity={0.7}
                    onPress={() =>
                      section.kind === 'sops'
                        ? handleDuplicateSop(t.id)
                        : handleDuplicateTaskList(t.id)
                    }
                  >
                    <View style={styles.createOptionIcon}>
                      <Ionicons
                        name={section.kind === 'sops' ? 'clipboard-outline' : 'list-outline'}
                        size={18}
                        color={Colors.textSecondary}
                      />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.createOptionTitle} numberOfLines={1}>
                        {section.kind === 'sops' ? t.name : t.title}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            ),
        )}
        {createQuery.length > 0 &&
          createSops.length === 0 &&
          createTaskLists.length === 0 && (
            <Text style={styles.createEmpty}>No templates match your search.</Text>
          )}
      </Modal>

      {/* Per-card actions */}
      <Modal
        visible={menuFor != null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name ?? ''}
        size="sm"
      >
        {menuFor != null &&
          (() => {
            const { kind, id, name } = menuFor;
            return (
              <>
                {kind === 'tasks' &&
                  menuRow('person-add-outline', 'Assign', () => {
                    setMenuFor(null);
                    router.push(`/(admin)/task-lists/${id}?assign=true` as any);
                  })}
                {menuRow('pencil-outline', 'Edit', () => {
                  setMenuFor(null);
                  router.push(
                    (kind === 'sops'
                      ? `/(admin)/sops/editor?id=${id}`
                      : `/(admin)/task-lists/editor?id=${id}`) as any,
                  );
                })}
                {menuRow('copy-outline', 'Duplicate', () => {
                  setMenuFor(null);
                  if (kind === 'sops') handleDuplicateSop(id);
                  else handleDuplicateTaskList(id);
                })}
                {menuRow(
                  'trash-outline',
                  'Delete',
                  () => {
                    setMenuFor(null);
                    confirmDelete(kind, id, name);
                  },
                  true,
                )}
              </>
            );
          })()}
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
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  menuRowText: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },
  lastCompletedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  lastCompletedIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  lastCompletedLabel: {
    fontSize: FontSize.xxs,
    fontWeight: '700',
    color: Colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
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
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  completedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  completedToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  completedCount: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
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
  createSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    minHeight: 40,
  },
  createSearchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
  },
  createEmpty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});
