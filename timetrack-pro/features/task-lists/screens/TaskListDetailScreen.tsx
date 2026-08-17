import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Modal as RNModal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/features/auth/auth-provider';
import {
  useTaskList,
  useTaskListAssignments,
  useTaskListRecurrences,
  useSaveAssignments,
  useSaveRecurrence,
  useDeleteRecurrence,
} from '@/features/task-lists/hooks';
import { RECURRENCE_WINDOW_DAYS } from '@/features/task-lists/api';
import ShareListButton from '@/features/task-lists/components/ShareListButton';
import { useTeamMembers } from '@/features/team/hooks';
import { useEquipment } from '@/features/equipment/hooks';
import {
  EQUIPMENT_MODE_LABEL,
  parseEquipmentRefs,
  placementSummary,
} from '@/features/equipment/refs';
import TaskDetailSheet, {
  type TaskDetailItem,
} from '@/features/task-lists/components/TaskDetailSheet';
import { getLocationLabel } from '@/features/locations/zones';
import { qk } from '@/lib/query-keys';
import {
  fetchScheduledShifts,
  parseShiftType,
  type ScheduledShift,
} from '@/features/schedule/api';
import {
  addDays,
  formatEndTime,
  formatScheduleTime,
  isValidDateInput,
  parseDateString,
  toDateString,
} from '@/features/schedule/lib';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/** Sunday-first, matching Date.getDay() and the schedule's week start. */
const WEEKDAYS = [
  { day: 0, initial: 'S', short: 'Sun' },
  { day: 1, initial: 'M', short: 'Mon' },
  { day: 2, initial: 'T', short: 'Tue' },
  { day: 3, initial: 'W', short: 'Wed' },
  { day: 4, initial: 'T', short: 'Thu' },
  { day: 5, initial: 'F', short: 'Fri' },
  { day: 6, initial: 'S', short: 'Sat' },
];

/** 'Mon, Wed, Fri' — or 'Every day' / 'Weekdays' / 'Weekends' when it fits. */
function repeatLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join(',');
  if (key === '0,1,2,3,4,5,6') return 'Every day';
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  return sorted
    .map((d) => WEEKDAYS.find((w) => w.day === d)?.short ?? '')
    .filter(Boolean)
    .join(', ');
}

/** 'Thu, Aug 13' */
function dueLabel(dateStr: string): string {
  return parseDateString(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** 'Thu, Aug 13 · 9:00 AM – 5:00 PM' */
function shiftLabel(
  shift: Pick<ScheduledShift, 'shift_date' | 'start_time' | 'end_time'>,
): string {
  const date = parseDateString(shift.shift_date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${date} · ${formatScheduleTime(shift.start_time)} – ${formatEndTime(shift.start_time, shift.end_time)}`;
}

/** The member's regular shifts from today forward (time off / OOT excluded). */
function useUpcomingShifts(employeeId: string | null) {
  const startDate = toDateString(new Date());
  const endDate = toDateString(addDays(new Date(), 90));
  return useQuery({
    queryKey: qk.schedule.shifts({ upcomingFor: employeeId, startDate }),
    queryFn: async () => {
      const rows = await fetchScheduledShifts({
        startDate,
        endDate,
        employeeId: employeeId!,
      });
      return rows.filter((sh) => parseShiftType(sh.note).type === 'shift');
    },
    enabled: !!employeeId,
  });
}

export default function TaskListDetailScreen() {
  const { id, assign } = useLocalSearchParams<{ id: string; assign?: string }>();
  const taskListId = id ?? '';
  const { user } = useAuth();
  const { data, isLoading } = useTaskList(taskListId);
  const { data: assignments } = useTaskListAssignments(taskListId);
  const { data: recurrences } = useTaskListRecurrences(taskListId);
  const { data: members } = useTeamMembers();
  const { data: equipment } = useEquipment();
  const saveAssignments = useSaveAssignments();
  const saveRecurrence = useSaveRecurrence();
  const deleteRecurrence = useDeleteRecurrence();

  const [showAssign, setShowAssign] = useState(assign === 'true');
  const [pendingMember, setPendingMember] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [dueDate, setDueDate] = useState(toDateString(new Date()));
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<TaskDetailItem | null>(null);

  const { data: upcomingShifts, isLoading: shiftsLoading } = useUpcomingShifts(
    pendingMember?.id ?? null,
  );

  const equipmentNames = useMemo(
    () => new Map((equipment ?? []).map((e: any) => [e.id, e.name])),
    [equipment],
  );

  const items = data?.items ?? [];
  const numbered = useMemo(() => {
    let n = 0;
    return items.map((it) => ({
      item: it,
      num: it.item_type === 'section' ? null : ++n,
    }));
  }, [items]);

  const closeAssign = () => {
    setShowAssign(false);
    setPendingMember(null);
    setDueDate(toDateString(new Date()));
    setSelectedShiftId(null);
    setRepeatDays([]);
  };

  const toggleRepeatDay = (day: number) =>
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );

  /** Picking a shift also dates the assignment to that shift's day. */
  const pickShift = (shift: ScheduledShift) => {
    if (selectedShiftId === shift.id) {
      setSelectedShiftId(null);
      return;
    }
    setSelectedShiftId(shift.id);
    setDueDate(shift.shift_date);
  };

  const handleSaveAssignment = async () => {
    if (!pendingMember) return;
    if (dueDate && !isValidDateInput(dueDate)) {
      Alert.alert('Invalid date', 'Use the YYYY-MM-DD format.');
      return;
    }
    setSaving(true);
    try {
      if (repeatDays.length > 0) {
        // A weekly rule generates its own dated assignments, so the picked
        // shift doesn't carry over — future shifts aren't known yet.
        await saveRecurrence.mutateAsync({
          taskListId,
          assignedTo: pendingMember.id,
          daysOfWeek: repeatDays,
          startDate: dueDate || null,
          createdBy: user?.id ?? '',
        });
      } else {
        await saveAssignments.mutateAsync({
          taskListId,
          assignedTo: [pendingMember.id],
          assignedBy: user?.id ?? '',
          shiftId: selectedShiftId,
          dueDate: dueDate || null,
        });
      }
      closeAssign();
    } catch {
      Alert.alert('Error', 'Failed to assign task list');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecurrence = (id: string, label: string) => {
    Alert.alert(
      'Stop repeating',
      `Stop generating "${label}"? Assignments already created stay put.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: () => deleteRecurrence.mutate(id),
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const taskList = data?.taskList;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.topBarActions}>
          <ShareListButton taskListId={taskListId} />
          <TouchableOpacity
            onPress={() =>
              router.push(`/(admin)/task-lists/editor?id=${taskListId}` as any)
            }
            style={styles.editBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit task list"
          >
            <Ionicons name="pencil-outline" size={16} color={Colors.accent} />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{taskList?.title}</Text>
        {taskList?.description ? (
          <Text style={styles.description}>{taskList.description}</Text>
        ) : null}

        <View style={styles.assignSection}>
          <View style={styles.assignHeader}>
            <Text style={styles.subheading}>Assignments</Text>
            <Button title="Assign" onPress={() => setShowAssign(true)} size="sm" />
          </View>

          {assignments?.length ? (
            assignments.map((a: any) => {
              const profile = a.profiles;
              const name = profile
                ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
                : 'Unknown';
              const shift = a.scheduled_shifts;
              return (
                <Card key={a.id} style={styles.assignCard}>
                  <View style={styles.assignInfo}>
                    <Text style={styles.assignName}>{name}</Text>
                    {shift ? (
                      <View style={styles.shiftRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color={Colors.textSecondary}
                        />
                        <Text style={styles.shiftText}>{shiftLabel(shift)}</Text>
                      </View>
                    ) : a.due_date ? (
                      <View style={styles.shiftRow}>
                        <Ionicons
                          name={
                            a.recurrence_id ? 'repeat-outline' : 'calendar-outline'
                          }
                          size={13}
                          color={Colors.textSecondary}
                        />
                        <Text style={styles.shiftText}>
                          {dueLabel(a.due_date)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      a.status === 'completed' && styles.statusComplete,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        a.status === 'completed' && styles.statusTextComplete,
                      ]}
                    >
                      {a.status}
                    </Text>
                  </View>
                </Card>
              );
            })
          ) : (
            <Text style={styles.emptyText}>Not assigned to anyone yet</Text>
          )}

          {recurrences?.length ? (
            <>
              <Text style={styles.subheading}>Repeats</Text>
              {recurrences.map((r) => {
                const name = r.profiles
                  ? `${r.profiles.first_name ?? ''} ${r.profiles.last_name ?? ''}`.trim()
                  : 'Unknown';
                const label = repeatLabel(r.days_of_week ?? []);
                return (
                  <Card key={r.id} style={styles.assignCard}>
                    <View style={styles.assignInfo}>
                      <Text style={styles.assignName}>{name}</Text>
                      <View style={styles.shiftRow}>
                        <Ionicons
                          name="repeat-outline"
                          size={13}
                          color={Colors.textSecondary}
                        />
                        <Text style={styles.shiftText}>
                          {label}
                          {r.start_date ? ` · from ${dueLabel(r.start_date)}` : ''}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        handleDeleteRecurrence(r.id, `${label} — ${name}`)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Stop repeating for ${name}`}
                      style={styles.repeatDelete}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={20}
                        color={Colors.textMuted}
                      />
                    </TouchableOpacity>
                  </Card>
                );
              })}
            </>
          ) : null}
        </View>

        <Text style={styles.subheading}>Items</Text>
        {numbered.length ? (
          <View style={styles.itemList}>
            {numbered.map(({ item, num }) =>
              item.item_type === 'section' ? (
                <Text key={item.id} style={styles.sectionLabel}>
                  {item.title}
                </Text>
              ) : (
                <View key={item.id} style={styles.item}>
                  <View style={styles.itemNum}>
                    <Text style={styles.itemNumText}>{num}</Text>
                  </View>
                  {item.media && item.media.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => setFullImageUri(item.media[0].url)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: item.media[0].url }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.itemBody}
                    onPress={() => setDetailItem(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} details`}
                  >
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.description ? (
                      <Text style={styles.itemDesc}>{item.description}</Text>
                    ) : null}
                    {(item.location_from || item.location_to) && (
                      <View style={styles.zoneRow}>
                        <Ionicons
                          name="location-outline"
                          size={13}
                          color={Colors.textSecondary}
                        />
                        <Text style={styles.zoneText}>
                          {item.location_from && item.location_to
                            ? `${getLocationLabel(item.location_from)} → ${getLocationLabel(item.location_to)}`
                            : getLocationLabel(
                                item.location_from ?? item.location_to,
                              )}
                        </Text>
                      </View>
                    )}
                    {parseEquipmentRefs(item.equipment).map((ref) => {
                      const placement = placementSummary(ref, item);
                      return (
                        <View key={ref.id} style={styles.equipmentRow}>
                          <Ionicons
                            name="cube-outline"
                            size={13}
                            color={Colors.textSecondary}
                          />
                          <Text style={styles.equipmentText} numberOfLines={2}>
                            <Text
                              style={[
                                styles.equipmentMode,
                                ref.mode === 'return' && styles.equipmentModeReturn,
                              ]}
                            >
                              {EQUIPMENT_MODE_LABEL[ref.mode].toUpperCase()}
                              {'  '}
                            </Text>
                            <Text style={styles.equipmentName}>
                              {equipmentNames.get(ref.id) ?? 'Equipment'}
                            </Text>
                            {placement ? `  ${placement}` : ''}
                          </Text>
                        </View>
                      );
                    })}
                    {item.media && item.media.length > 1 && (
                      <View style={styles.mediaRow}>
                        {item.media.slice(1).map(
                          (m: { url: string }, i: number) => (
                            <TouchableOpacity
                              key={i}
                              onPress={() => setFullImageUri(m.url)}
                              activeOpacity={0.8}
                            >
                              <Image
                                source={{ uri: m.url }}
                                style={styles.extraThumb}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ),
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ),
            )}
          </View>
        ) : (
          <Text style={styles.emptyText}>No items in this task list</Text>
        )}

        <Modal
          visible={showAssign}
          onClose={closeAssign}
          title={pendingMember ? 'Pick a shift' : 'Assign Task List'}
        >
          {!pendingMember ? (
            members?.map((member) => (
              <Card
                key={member.id}
                style={styles.memberPick}
                onPress={() =>
                  setPendingMember({
                    id: member.id,
                    name: `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim(),
                  })
                }
              >
                <Text style={styles.memberPickName}>
                  {member.first_name} {member.last_name}
                </Text>
                <Text style={styles.memberPickEmail}>{member.email}</Text>
              </Card>
            ))
          ) : (
            <>
              <Text style={styles.assigningTo}>
                Assigning to {pendingMember.name || 'member'}.
              </Text>

              <Input
                label={repeatDays.length ? 'Starting' : 'Date'}
                placeholder="YYYY-MM-DD"
                value={dueDate}
                onChangeText={(t) => {
                  setDueDate(t);
                  setSelectedShiftId(null);
                }}
              />

              <Text style={styles.fieldLabel}>Repeat weekly on</Text>
              <View style={styles.dayRow}>
                {WEEKDAYS.map((w, idx) => {
                  const on = repeatDays.includes(w.day);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.dayPill, on && styles.dayPillOn]}
                      onPress={() => toggleRepeatDay(w.day)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={w.short}
                    >
                      <Text style={[styles.dayPillText, on && styles.dayPillTextOn]}>
                        {w.initial}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.hint}>
                {repeatDays.length
                  ? `Repeats ${repeatLabel(repeatDays).toLowerCase()} — assignments are created ${RECURRENCE_WINDOW_DAYS} days ahead.`
                  : 'Leave empty for a one-off assignment.'}
              </Text>

              {repeatDays.length === 0 ? (
                <>
                  <Text style={styles.fieldLabel}>Shift (optional)</Text>
                  {shiftsLoading ? (
                    <ActivityIndicator
                      color={Colors.accent}
                      style={styles.shiftsLoading}
                    />
                  ) : upcomingShifts?.length ? (
                    upcomingShifts.map((shift) => {
                      const on = selectedShiftId === shift.id;
                      return (
                        <Card
                          key={shift.id}
                          style={{
                            ...styles.shiftPick,
                            ...(on ? styles.shiftPickOn : null),
                          }}
                          onPress={() => pickShift(shift)}
                        >
                          <Ionicons
                            name={on ? 'checkmark-circle' : 'calendar-outline'}
                            size={16}
                            color={Colors.accent}
                          />
                          <Text style={styles.shiftPickText}>
                            {shiftLabel(shift)}
                          </Text>
                        </Card>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyText}>
                      No upcoming shifts scheduled.
                    </Text>
                  )}
                </>
              ) : null}

              <Button
                title={repeatDays.length ? 'Save repeating assignment' : 'Assign'}
                onPress={handleSaveAssignment}
                loading={saving}
              />
              <Button
                title="← Back to people"
                variant="ghost"
                size="sm"
                onPress={() => setPendingMember(null)}
              />
            </>
          )}
        </Modal>

        <RNModal
          visible={!!fullImageUri}
          transparent
          animationType="fade"
          onRequestClose={() => setFullImageUri(null)}
        >
          <TouchableOpacity
            style={styles.fullImageOverlay}
            activeOpacity={1}
            onPress={() => setFullImageUri(null)}
          >
            {fullImageUri ? (
              <Image
                source={{ uri: fullImageUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            ) : null}
          </TouchableOpacity>
        </RNModal>

        <TaskDetailSheet
          item={detailItem}
          equipment={equipment}
          onClose={() => setDetailItem(null)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgPrimary },
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
  backText: { fontSize: FontSize.md, color: Colors.text },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  editText: { fontSize: FontSize.md, color: Colors.accent, fontWeight: '600' },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  heading: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginVertical: Spacing.md },
  description: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.md },
  subheading: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  assignSection: { marginBottom: Spacing.md },
  assignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  assignInfo: { flex: 1, marginRight: Spacing.sm },
  assignName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.text },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  shiftText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full, backgroundColor: Colors.bgElevated },
  statusComplete: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500', textTransform: 'capitalize' },
  statusTextComplete: { color: Colors.success },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
  itemList: { gap: Spacing.sm },
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
  itemNum: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  itemNumText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.accent },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
    flexShrink: 0,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.text },
  itemDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  zoneText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  equipmentRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  equipmentText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary },
  equipmentName: { fontWeight: '600', color: Colors.text },
  equipmentMode: { fontSize: FontSize.xxs, fontWeight: '700', color: Colors.accent },
  equipmentModeReturn: { color: Colors.warning },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  extraThumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: { width: screenWidth, height: screenHeight },
  memberPick: { marginBottom: Spacing.sm },
  memberPickName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.text },
  memberPickEmail: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  assigningTo: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  shiftsLoading: { paddingVertical: Spacing.lg },
  shiftPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  shiftPickOn: { borderColor: Colors.accent },
  shiftPickText: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.text },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  dayRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.xs },
  dayPill: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dayPillText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  dayPillTextOn: { color: Colors.bgPrimary },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  repeatDelete: { padding: Spacing.xs },
})
