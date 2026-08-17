import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/auth-provider';
import {
  useSharedChecksRealtime,
  useTaskChecklistItems,
  useToggleTaskCheck,
} from '@/features/task-lists/hooks';
import ShareListButton from '@/features/task-lists/components/ShareListButton';
import ChecklistItemRow from '@/components/ui/ChecklistItemRow';
import { useEquipment } from '@/features/equipment/hooks';
import {
  EQUIPMENT_MODE_LABEL,
  parseEquipmentRefs,
  placementSummary,
} from '@/features/equipment/refs';
import TaskDetailSheet, {
  type TaskDetailItem,
} from '@/features/task-lists/components/TaskDetailSheet';
import { formatZoneSpan } from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

/** Media URLs that render as images (walkthrough videos live elsewhere). */
function imageUrls(media: unknown): string[] {
  if (!Array.isArray(media)) return [];
  return media
    .filter((m: any) => m?.url && !String(m.type ?? '').startsWith('video'))
    .map((m: any) => m.url as string);
}

/**
 * Contractor-facing checklist for one assigned task list. The `id` param is a
 * task_list_assignments id, not a task_lists id — checks are recorded per
 * assignment so two people working the same list don't collide.
 *
 * Checks made through the list's public share link are merged in and stream in
 * live, so the assignee and a crew working off the shared web page see one
 * combined state.
 */
export default function TaskChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignmentId = id ?? '';
  const { user } = useAuth();
  const { data, isLoading } = useTaskChecklistItems(assignmentId);
  const toggleCheck = useToggleTaskCheck();
  const { data: equipment } = useEquipment();
  const [detailItem, setDetailItem] = useState<TaskDetailItem | null>(null);

  const taskListId = data?.taskList?.id as string | undefined;
  const shareToken = (data?.taskList as any)?.share_token ?? null;
  useSharedChecksRealtime(taskListId, assignmentId);

  const equipmentNames = useMemo(
    () => new Map((equipment ?? []).map((e: any) => [e.id, e.name])),
    [equipment],
  );

  const items = data?.items ?? [];
  const checkable = items.filter((i: any) => i.item_type !== 'section');
  const total = checkable.length;
  const checked = checkable.filter((i: any) => i.checked).length;
  const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;

  const handleToggle = (item: any) => {
    // The API records checks as inserts only; unchecking isn't supported yet,
    // so an already-checked item is a no-op rather than a failed request.
    if (item.checked || !user || !assignmentId) return;
    toggleCheck.mutate({
      assignmentId,
      taskListItemId: item.id,
      checkedBy: user.id,
      checkedCountAfter: checked + 1,
      totalCount: total,
      shareToken,
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <ShareListButton taskListId={taskListId} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {isLoading ? (
          <Text style={s.muted}>Loading...</Text>
        ) : !data ? (
          <View style={s.centeredState}>
            <Text style={s.stateTitle}>Checklist unavailable</Text>
            <Text style={s.muted}>
              This assignment may have been removed.
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.heading}>
              {data.taskList?.title ?? 'Task list'}
            </Text>
            {data.taskList?.description ? (
              <Text style={s.description}>{data.taskList.description}</Text>
            ) : null}

            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${percentage}%` }]} />
            </View>
            <Text style={s.progressText}>
              {checked} of {total} complete ({percentage}%)
            </Text>

            <View style={s.itemList}>
              {items.map((item: any) =>
                item.item_type === 'section' ? (
                  <Text key={item.id} style={s.sectionLabel}>
                    {item.title}
                  </Text>
                ) : (
                  <ChecklistItemRow
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    images={imageUrls(item.media)}
                    locationLabel={formatZoneSpan(
                      item.location_from,
                      item.location_to,
                    )}
                    equipment={parseEquipmentRefs(item.equipment).map((ref) => ({
                      name: equipmentNames.get(ref.id) ?? 'Equipment',
                      placement: placementSummary(ref, item),
                      modeLabel: EQUIPMENT_MODE_LABEL[ref.mode],
                      isReturn: ref.mode === 'return',
                    }))}
                    onOpenDetails={() => setDetailItem(item)}
                    checked={item.checked}
                    checkedByName={
                      item.checkedViaShare ? 'shared link' : null
                    }
                    onToggle={() => handleToggle(item)}
                  />
                ),
              )}
            </View>

            {total > 0 && checked === total && (
              <View style={s.doneBanner}>
                <Text style={s.doneText}>All items complete ✓</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TaskDetailSheet
        item={detailItem}
        equipment={equipment}
        onClose={() => setDetailItem(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,
  },
  backText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
  },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  itemList: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
  },
  doneBanner: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
  },
  doneText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.success,
  },
  centeredState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  stateTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  muted: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
