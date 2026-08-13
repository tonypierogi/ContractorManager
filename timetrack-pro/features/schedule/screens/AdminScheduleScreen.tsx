import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTeamMembers } from '@/features/team/hooks';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { parseShiftType, type ScheduledShift } from '../api';
import {
  useDeleteScheduledShift,
  useScheduleRange,
  useScheduledShifts,
  useScheduleTimeEntries,
} from '../hooks';
import {
  SCHEDULE_COLORS,
  memberDisplayName,
  normalizeTime,
  parseDateString,
  sortMembers,
  timeEntryToDisplayShift,
  toDateString,
} from '../lib';
import ScheduleToolbar from '../components/ScheduleToolbar';
import OptionPickerModal from '../components/OptionPickerModal';
import AdminWeekGrid from '../components/AdminWeekGrid';
import AdminMonthGrid from '../components/AdminMonthGrid';
import PaySummary from '../components/PaySummary';
import ShiftFormModal, {
  type ShiftFormInitial,
} from '../components/ShiftFormModal';

type TypeFilter = 'both' | 'scheduled' | 'logged';

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'both', label: 'Scheduled + Logged' },
  { value: 'scheduled', label: 'Scheduled Only' },
  { value: 'logged', label: 'Logged Only' },
];

export default function AdminScheduleScreen() {
  const range = useScheduleRange();
  const { showToast } = useToast();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('both');
  const [memberFilter, setMemberFilter] = useState('');
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(new Set());
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [formInitial, setFormInitial] = useState<ShiftFormInitial | null>(null);
  const [formVisible, setFormVisible] = useState(false);

  const { data: rawMembers } = useTeamMembers();
  const members = useMemo(() => sortMembers(rawMembers ?? []), [rawMembers]);

  const startDate = toDateString(range.start);
  const endDate = toDateString(range.end);

  const { data: shifts } = useScheduledShifts({
    startDate,
    endDate,
    employeeId: memberFilter || undefined,
  });
  const { data: entries } = useScheduleTimeEntries({
    startISO: range.start.toISOString(),
    endISO: range.end.toISOString(),
    employeeId: memberFilter || undefined,
  });
  const deleteShift = useDeleteScheduledShift();

  const logged = useMemo(
    () => (entries ?? []).map(timeEntryToDisplayShift),
    [entries],
  );

  // Member colors indexed off the FULL members list in ALL views
  // (deviation: normalizes the legacy week-view filtered-index bug).
  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m, i) => map.set(m.id, SCHEDULE_COLORS[i % 8]));
    return (memberId: string) => map.get(memberId) ?? SCHEDULE_COLORS[0];
  }, [members]);

  const filteredMembers = useMemo(
    () => (memberFilter ? members.filter((m) => m.id === memberFilter) : members),
    [members, memberFilter],
  );
  const weekMembers = useMemo(
    () => filteredMembers.filter((m) => !hiddenMembers.has(m.id)),
    [filteredMembers, hiddenMembers],
  );

  const openCreateShift = () => {
    setFormInitial({ type: 'shift' });
    setFormVisible(true);
  };

  const openTimeOff = () => {
    setFormInitial({ type: 'time_off' });
    setFormVisible(true);
  };

  const openAdd = (employeeId: string, dateStr: string) => {
    setFormInitial({
      type: 'shift',
      employeeId: employeeId || undefined,
      date: dateStr,
    });
    setFormVisible(true);
  };

  const openEdit = (shift: ScheduledShift) => {
    const decoded = parseShiftType(shift.note);
    setFormInitial({
      id: shift.id,
      employeeId: shift.employee_id,
      date: shift.shift_date,
      type: decoded.type,
      startTime: normalizeTime(shift.start_time),
      endTime: normalizeTime(shift.end_time),
      note: decoded.note,
    });
    setFormVisible(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete this scheduled shift?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShift.mutateAsync(id);
            showToast('Shift removed from schedule');
          } catch {
            // Global mutation error toast handles failures.
          }
        },
      },
    ]);
  };

  // Legacy post-save behavior: repeat inserts and time-off saves while in
  // week view jump to the month view of the start month.
  const handleSaved = ({
    type,
    startDate: savedStart,
    multi,
  }: {
    type: string;
    startDate: string;
    multi: boolean;
  }) => {
    if (range.viewMode === 'week' && (multi || type !== 'shift')) {
      const d = parseDateString(savedStart);
      range.jumpToMonth(d.getMonth(), d.getFullYear());
    }
  };

  const toggleHidden = (memberId: string) => {
    setHiddenMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const selectedMember = members.find((m) => m.id === memberFilter);
  const typeFilterLabel =
    TYPE_FILTER_OPTIONS.find((o) => o.value === typeFilter)?.label ?? '';

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Team Schedule</Text>
        </View>
        <View style={styles.actionsRow}>
          <Button title="Time Off" variant="secondary" size="sm" onPress={openTimeOff} />
          <Button title="Schedule Shift" size="sm" onPress={openCreateShift} />
        </View>

        <View style={styles.panel}>
          <ScheduleToolbar
            viewMode={range.viewMode}
            label={range.label}
            onSetViewMode={range.setViewMode}
            onPrev={range.goPrev}
            onNext={range.goNext}
            onToday={range.goToday}
          />
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.filterField}
              onPress={() => setShowTypePicker(true)}
            >
              <Text style={styles.filterText} numberOfLines={1}>
                {typeFilterLabel}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterField}
              onPress={() => setShowMemberPicker(true)}
            >
              <Text
                style={selectedMember ? styles.filterText : styles.filterMuted}
                numberOfLines={1}
              >
                {selectedMember ? memberDisplayName(selectedMember) : 'All Members'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.panel}>
          {range.viewMode === 'week' ? (
            <AdminWeekGrid
              weekStart={range.weekStart}
              displayMembers={weekMembers}
              hiddenCount={filteredMembers.length - weekMembers.length}
              shifts={shifts ?? []}
              logged={logged}
              typeFilter={typeFilter}
              colorFor={colorFor}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ) : (
            <AdminMonthGrid
              year={range.year}
              month={range.month}
              members={members}
              hiddenMembers={hiddenMembers}
              shifts={shifts ?? []}
              logged={logged}
              typeFilter={typeFilter}
              colorFor={colorFor}
              onAdd={(dateStr) => openAdd('', dateStr)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </View>

        <View style={styles.panel}>
          <PaySummary
            displayMembers={filteredMembers}
            shifts={shifts ?? []}
            entries={entries ?? []}
            hiddenMembers={hiddenMembers}
            periodLabel={range.label}
            colorFor={colorFor}
            onToggleHidden={toggleHidden}
            onShowAll={() => setHiddenMembers(new Set())}
          />
        </View>
      </ScrollView>

      <ShiftFormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        members={members}
        initial={formInitial}
        onSaved={handleSaved}
      />
      <OptionPickerModal
        visible={showTypePicker}
        title="Show"
        options={TYPE_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        selected={typeFilter}
        onSelect={(v) => setTypeFilter(v as TypeFilter)}
        onClose={() => setShowTypePicker(false)}
      />
      <OptionPickerModal
        visible={showMemberPicker}
        title="Team Member"
        options={[
          { value: '', label: 'All Members' },
          ...members.map((m) => ({ value: m.id, label: memberDisplayName(m) })),
        ]}
        selected={memberFilter}
        onSelect={setMemberFilter}
        onClose={() => setShowMemberPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    paddingBottom: Spacing.xl,
  },
  headerRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  filterField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    minHeight: 40,
    gap: Spacing.xs,
  },
  filterText: {
    fontSize: FontSize.xs,
    color: Colors.text,
    flex: 1,
  },
  filterMuted: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
});
