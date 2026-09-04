import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import CopyToSpreadsheetButton, {
  type SpreadsheetColumn,
} from '@/features/shifts/components/CopyToSpreadsheetButton';
import {
  useAllShifts,
  useToggleShiftPaid,
  useBulkSetShiftsPaid,
} from '@/features/shifts/hooks';
import { useTeamMembers } from '@/features/team/hooks';
import { useToast } from '@/components/ui/Toast';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatDate, formatTime, formatCurrency } from '@/utils/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Default to the last 30 days so the unfiltered view doesn't load every
// time entry ever recorded. Clearing the field and filtering shows all.
function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function TimesheetsScreen() {
  const [employeeFilter, setEmployeeFilter] = useState('');
  // Draft values track the inputs; applied values feed the query only when
  // the Filter button commits them (typing must not fire queries).
  const [startDraft, setStartDraft] = useState(defaultStartDate);
  const [endDraft, setEndDraft] = useState('');
  const [appliedDates, setAppliedDates] = useState<{ start?: string; end?: string }>(
    () => ({ start: defaultStartDate() }),
  );
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  const { data: members } = useTeamMembers();
  const { data: shifts, isLoading, refetch } = useAllShifts({
    userId: employeeFilter || undefined,
    startDate: appliedDates.start,
    endDate: appliedDates.end,
  });
  const togglePaid = useToggleShiftPaid();
  const bulkSetPaid = useBulkSetShiftsPaid();

  // Drop any selected id that's no longer in the loaded rows — a changed
  // filter or a refetch after a mutation can otherwise leave stale ids
  // selected that the user can no longer see.
  useEffect(() => {
    if (!shifts) return;
    const visibleIds = new Set(shifts.map((s: any) => s.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [shifts]);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allVisibleSelected = !!shifts && shifts.length > 0 && selected.size === shifts.length;

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (!shifts || shifts.length === 0) return prev;
      if (prev.size === shifts.length) return new Set();
      return new Set(shifts.map((s: any) => s.id));
    });
  }, [shifts]);

  const handleBulkSetPaid = useCallback(
    (paid: boolean) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      bulkSetPaid.mutate(
        { ids, paid },
        {
          onSuccess: () => {
            setSelected(new Set());
            showToast(
              `Marked ${ids.length} shift${ids.length === 1 ? '' : 's'} as ${paid ? 'paid' : 'pending'}`,
              'success',
            );
          },
          onError: () => showToast('Could not update those shifts', 'error'),
        },
      );
    },
    [selected, bulkSetPaid, showToast],
  );

  const applyFilters = () => {
    const start = startDraft.trim();
    const end = endDraft.trim();
    if ((start && !DATE_RE.test(start)) || (end && !DATE_RE.test(end))) {
      showToast('Dates must be in YYYY-MM-DD format', 'error');
      return;
    }
    setAppliedDates({ start: start || undefined, end: end || undefined });
  };

  const selectedMember = members?.find((m) => m.id === employeeFilter);

  const memberById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof members>[number]>();
    (members ?? []).forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const getMemberName = useCallback(
    (item: any) => {
      // Prefer the name joined onto the row — the members query can lag or
      // fail independently, which showed 'Unknown' despite loaded rows.
      const p = item.profiles;
      if (p) {
        const joined = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
        if (joined) return joined;
      }
      const m = memberById.get(item.user_id);
      return m ? `${m.first_name} ${m.last_name}`.trim() || 'Unknown' : 'Unknown';
    },
    [memberById],
  );

  const getHourlyRate = useCallback(
    (item: any) => {
      if (item.profiles?.hourly_rate != null) return item.profiles.hourly_rate;
      return memberById.get(item.user_id)?.hourly_rate ?? 0;
    },
    [memberById],
  );

  const calcHours = (clockIn: string, clockOut: string | null): number => {
    if (!clockOut) return 0;
    return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
  };

  // Export mirrors the rendered table (same helpers/formatters), but with
  // clean aligned columns — the legacy admin export emitted 9 fields against
  // a 7-column header (spreadsheet.js quirk), fixed intentionally here.
  const exportColumns: SpreadsheetColumn<any>[] = [
    { header: 'Contractor', value: (item) => getMemberName(item) },
    { header: 'Date', value: (item) => formatDate(item.clock_in) },
    { header: 'Clock In', value: (item) => formatTime(item.clock_in) },
    {
      header: 'Clock Out',
      value: (item) => (item.clock_out ? formatTime(item.clock_out) : 'In progress'),
    },
    { header: 'Hours', value: (item) => calcHours(item.clock_in, item.clock_out).toFixed(2) },
    { header: 'Rate', value: (item) => Number(getHourlyRate(item)).toFixed(2) },
    { header: 'Status', value: (item) => (item.paid ? 'Paid' : 'Pending') },
    {
      header: 'Amount',
      value: (item) =>
        (calcHours(item.clock_in, item.clock_out) * Number(getHourlyRate(item))).toFixed(2),
    },
  ];

  const totals = useMemo(() => {
    if (!shifts) return { hours: 0, amount: 0 };
    return shifts.reduce(
      (acc, s: any) => {
        const hrs = calcHours(s.clock_in, s.clock_out);
        const rate = s.profiles?.hourly_rate ?? 0;
        return { hours: acc.hours + hrs, amount: acc.amount + hrs * rate };
      },
      { hours: 0, amount: 0 },
    );
  }, [shifts]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const hours = calcHours(item.clock_in, item.clock_out);
      const rate = getHourlyRate(item);
      const amount = hours * rate;
      const isPaid = item.paid;
      const isSelected = selected.has(item.id);

      return (
        <View style={[styles.tableRow, isSelected && styles.tableRowSelected]}>
          <TouchableOpacity style={styles.cellCheckbox} onPress={() => toggleRow(item.id)}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={20}
              color={isSelected ? Colors.accent : Colors.textMuted}
            />
          </TouchableOpacity>
          <Text style={[styles.cell, styles.cellEmployee]} numberOfLines={1}>
            {getMemberName(item)}
          </Text>
          <Text style={[styles.cell, styles.cellDate]}>
            {formatDate(item.clock_in)}
          </Text>
          <Text style={[styles.cell, styles.cellTime]}>
            {formatTime(item.clock_in)}
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellTime,
              !item.clock_out && styles.inProgressText,
            ]}
          >
            {item.clock_out ? formatTime(item.clock_out) : 'In progress'}
          </Text>
          <Text style={[styles.cell, styles.cellHours]}>
            {hours > 0 ? hours.toFixed(2) : '0.00'}
          </Text>
          <Text style={[styles.cell, styles.cellRate]}>
            {formatCurrency(rate)}/hr
          </Text>
          <TouchableOpacity
            style={styles.cellStatus}
            onPress={() => togglePaid.mutate({ id: item.id, paid: !isPaid })}
          >
            <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgePending]}>
              <View style={[styles.badgeDot, isPaid ? styles.dotPaid : styles.dotPending]} />
              <Text style={[styles.badgeText, isPaid ? styles.badgePaidText : styles.badgePendingText]}>
                {isPaid ? 'PAID' : 'PENDING'}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.cell, styles.cellAmount]}>
            {formatCurrency(amount)}
          </Text>
          <TouchableOpacity style={styles.cellEdit}>
            <Ionicons name="create-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      );
    },
    // togglePaid.mutate is referentially stable; the mutation object is not
    [getMemberName, getHourlyRate, togglePaid.mutate, selected, toggleRow],
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <Text style={styles.heading}>All Timesheets</Text>

      <View style={styles.panel}>
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={styles.employeeDropdown}
            onPress={() => setShowEmployeePicker(true)}
          >
            <Text style={selectedMember ? styles.dropdownText : styles.dropdownPlaceholder}>
              {selectedMember
                ? `${selectedMember.first_name} ${selectedMember.last_name}`
                : 'All Contractors'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.dateField}>
            <Input
              placeholder="Start date"
              value={startDraft}
              onChangeText={setStartDraft}
            />
          </View>
          <Text style={styles.dateSeparator}>to</Text>
          <View style={styles.dateField}>
            <Input
              placeholder="End date"
              value={endDraft}
              onChangeText={setEndDraft}
            />
          </View>
          <Button title="Filter" onPress={applyFilters} variant="secondary" size="sm" />
          <CopyToSpreadsheetButton rows={shifts ?? []} columns={exportColumns} />
        </View>

        {selected.size > 0 && (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkBarText}>{selected.size} selected</Text>
            <View style={styles.bulkBarActions}>
              <Button
                title="Mark as pending"
                onPress={() => handleBulkSetPaid(false)}
                variant="secondary"
                size="sm"
                disabled={bulkSetPaid.isPending}
              />
              <Button
                title="Mark as paid"
                onPress={() => handleBulkSetPaid(true)}
                size="sm"
                disabled={bulkSetPaid.isPending}
              />
              <TouchableOpacity onPress={() => setSelected(new Set())} style={styles.bulkBarClear}>
                <Text style={styles.bulkBarClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <TouchableOpacity style={styles.cellCheckbox} onPress={toggleSelectAll}>
                <Ionicons
                  name={
                    allVisibleSelected
                      ? 'checkbox'
                      : selected.size > 0
                        ? 'checkbox-outline'
                        : 'square-outline'
                  }
                  size={20}
                  color={selected.size > 0 ? Colors.accent : Colors.textMuted}
                />
              </TouchableOpacity>
              <Text style={[styles.headerCell, styles.cellEmployee]}>CONTRACTOR</Text>
              <Text style={[styles.headerCell, styles.cellDate]}>DATE</Text>
              <Text style={[styles.headerCell, styles.cellTime]}>CLOCK IN</Text>
              <Text style={[styles.headerCell, styles.cellTime]}>CLOCK OUT</Text>
              <Text style={[styles.headerCell, styles.cellHours]}>HOURS</Text>
              <Text style={[styles.headerCell, styles.cellRate]}>RATE</Text>
              <Text style={[styles.headerCell, styles.cellStatus]}>STATUS</Text>
              <Text style={[styles.headerCell, styles.cellAmount]}>AMOUNT</Text>
              <View style={styles.cellEdit} />
            </View>

            <FlatList
              data={shifts ?? []}
              renderItem={renderItem}
              keyExtractor={(item: any) => item.id}
              refreshing={isLoading}
              onRefresh={refetch}
              ListEmptyComponent={
                !isLoading ? <EmptyState title="No shifts found" /> : null
              }
            />

            {shifts && shifts.length > 0 && (
              <View style={styles.totalsRow}>
                <View style={styles.cellCheckbox} />
                <Text style={[styles.totalsLabel, styles.cellEmployee]}>Total:</Text>
                <View style={styles.cellDate} />
                <View style={styles.cellTime} />
                <View style={styles.cellTime} />
                <Text style={[styles.totalsValue, styles.cellHours]}>
                  {totals.hours.toFixed(2)}
                </Text>
                <View style={styles.cellRate} />
                <View style={styles.cellStatus} />
                <Text style={[styles.totalsAmount, styles.cellAmount]}>
                  {formatCurrency(totals.amount)}
                </Text>
                <View style={styles.cellEdit} />
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={showEmployeePicker}
        onClose={() => setShowEmployeePicker(false)}
        title="Select Contractor"
      >
        <TouchableOpacity
          style={[styles.pickerItem, !employeeFilter && styles.pickerItemSelected]}
          onPress={() => {
            setEmployeeFilter('');
            setShowEmployeePicker(false);
          }}
        >
          <Text style={styles.pickerItemText}>All Contractors</Text>
        </TouchableOpacity>
        {(members ?? []).map((member) => (
          <TouchableOpacity
            key={member.id}
            style={[styles.pickerItem, member.id === employeeFilter && styles.pickerItemSelected]}
            onPress={() => {
              setEmployeeFilter(member.id);
              setShowEmployeePicker(false);
            }}
          >
            <Text style={styles.pickerItemText}>
              {[member.first_name, member.last_name].filter(Boolean).join(' ') || member.email}
            </Text>
          </TouchableOpacity>
        ))}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    margin: Spacing.lg,
    flex: 1,
    overflow: 'hidden',
  },
  filterBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  employeeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.bgSecondary,
    minWidth: 180,
    flex: 1,
  },
  dropdownText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  dateField: {
    minWidth: 130,
  },
  dateSeparator: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: 4,
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bulkBarText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  bulkBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bulkBarClear: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  bulkBarClearText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  tableContainer: {
    minWidth: 890,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.bgElevated,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  headerCell: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  cell: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  cellEmployee: {
    flex: 1.8,
  },
  cellDate: {
    flex: 1.4,
  },
  cellTime: {
    flex: 1.2,
  },
  cellHours: {
    flex: 0.8,
  },
  cellRate: {
    flex: 1,
    color: Colors.textSecondary,
  },
  cellStatus: {
    flex: 1.2,
  },
  cellAmount: {
    flex: 1,
    fontWeight: '600',
    color: Colors.accent,
  },
  cellEdit: {
    width: 32,
    alignItems: 'center',
  },
  cellCheckbox: {
    width: 32,
    alignItems: 'center',
  },
  tableRowSelected: {
    backgroundColor: Colors.accentGlow,
  },
  inProgressText: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  badge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: 10,
    gap: 6,
  },
  badgePaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotPaid: {
    backgroundColor: Colors.success,
  },
  dotPending: {
    backgroundColor: Colors.warning,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  badgePaidText: {
    color: Colors.success,
  },
  badgePendingText: {
    color: Colors.warning,
  },
  totalsRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  totalsLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  totalsValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  totalsAmount: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  pickerItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  pickerItemSelected: {
    backgroundColor: Colors.accentGlow,
  },
  pickerItemText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
});
