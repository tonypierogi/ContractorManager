import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal as RNModal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/auth-provider';
import {
  useTaskChecklistItems,
  useToggleTaskCheck,
} from '@/features/task-lists/hooks';
import { useEquipment } from '@/features/equipment/hooks';
import { getLocationLabel } from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

/**
 * Contractor-facing checklist for one assigned task list. The `id` param is a
 * task_list_assignments id, not a task_lists id — checks are recorded per
 * assignment so two people working the same list don't collide.
 */
export default function TaskChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignmentId = id ?? '';
  const { user } = useAuth();
  const { data, isLoading } = useTaskChecklistItems(assignmentId);
  const toggleCheck = useToggleTaskCheck();
  const { data: equipment } = useEquipment();
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);

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
                  <TouchableOpacity
                    key={item.id}
                    style={[s.item, item.checked && s.itemChecked]}
                    onPress={() => handleToggle(item)}
                    activeOpacity={item.checked ? 1 : 0.7}
                  >
                    <Ionicons
                      name={item.checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={item.checked ? Colors.accent : Colors.textMuted}
                    />
                    <View style={s.itemBody}>
                      <Text
                        style={[
                          s.itemTitle,
                          item.checked && s.itemTitleChecked,
                        ]}
                      >
                        {item.title}
                      </Text>
                      {item.description ? (
                        <Text style={s.itemDesc}>{item.description}</Text>
                      ) : null}
                      {(item.location_from || item.location_to) && (
                        <View style={s.zoneRow}>
                          <Ionicons
                            name="location-outline"
                            size={13}
                            color={Colors.textSecondary}
                          />
                          <Text style={s.zoneText}>
                            {item.location_from && item.location_to
                              ? `${getLocationLabel(item.location_from)} → ${getLocationLabel(item.location_to)}`
                              : getLocationLabel(
                                  item.location_from ?? item.location_to,
                                )}
                          </Text>
                        </View>
                      )}
                      {Array.isArray(item.equipment) &&
                        item.equipment.length > 0 && (
                          <View style={s.tagRow}>
                            {item.equipment.map((eqId: string) => (
                              <View key={eqId} style={s.tag}>
                                <Text style={s.tagText}>
                                  {equipmentNames.get(eqId) ?? 'Equipment'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      {Array.isArray(item.media) && item.media.length > 0 && (
                        <View style={s.mediaRow}>
                          {item.media.map(
                            (m: { url: string }, i: number) => (
                              <TouchableOpacity
                                key={i}
                                onPress={() => setFullImageUri(m.url)}
                                activeOpacity={0.8}
                              >
                                <Image
                                  source={{ uri: m.url }}
                                  style={s.thumbnail}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ),
                          )}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
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

      <RNModal
        visible={!!fullImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImageUri(null)}
      >
        <TouchableOpacity
          style={s.fullImageOverlay}
          activeOpacity={1}
          onPress={() => setFullImageUri(null)}
        >
          {fullImageUri ? (
            <Image
              source={{ uri: fullImageUri }}
              style={s.fullImage}
              resizeMode="contain"
            />
          ) : null}
        </TouchableOpacity>
      </RNModal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
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
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  itemChecked: {
    opacity: 0.6,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  itemTitleChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  itemDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  zoneText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  tag: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
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
