import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/ui/Button';
import ShiftRow from '@/features/shifts/components/ShiftRow';
import AddShiftModal from '@/features/shifts/components/AddShiftModal';
import CopyToSpreadsheetButton, {
  type SpreadsheetColumn,
} from '@/features/shifts/components/CopyToSpreadsheetButton';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/auth-provider';
import { useShifts, useAddShift, useDeleteShift } from '@/features/shifts/hooks';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { formatCurrency, formatDate, formatTime } from '@/utils/format';
import type { TimeEntry } from '@/types/database';

// In-progress shifts count as 0 hours everywhere (rows, totals, export) —
// legacy parity: hours accrue only once clocked out.
function getShiftHours(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  return (end - start) / 3600000;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date as YYYY-MM-DD (toISOString() would shift by timezone). */
function toISODate(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

type Range = { start: string; end: string };

const PRESETS: { key: string; label: string; range: () => Range }[] = [
  {
    key: 'thisMonth',
    label: 'This Month',
    range: () => {
      const now = new Date();
      return {
        start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    },
  },
  {
    key: 'lastMonth',
    label: 'Last Month',
    range: () => {
      const now = new Date();
      return {
        start: toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: toISODate(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    },
  },
  {
    key: 'last30',
    label: 'Last 30 Days',
    range: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { start: toISODate(start), end: toISODate(now) };
    },
  },
  {
    key: 'thisYear',
    label: 'This Year',
    range: () => {
      const now = new Date();
      return {
        start: toISODate(new Date(now.getFullYear(), 0, 1)),
        end: toISODate(new Date(now.getFullYear(), 11, 31)),
      };
    },
  },
  { key: 'all', label: 'All Time', range: () => ({ start: '', end: '' }) },
];

export default function ShiftsScreen() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? '';
  const hourlyRate = profile?.hourly_rate ?? 0;
  const { width } = useWindowDimensions();
  // The seven-column table only fits from tablet width up; phones get cards.
  const isTable = width >= 700;

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Only complete YYYY-MM-DD values reach the query — a half-typed date would
  // otherwise be parsed as some arbitrary day (or throw on toISOString()).
  const filters = useMemo(
    () => ({
      startDate: ISO_DATE.test(startDate) ? startDate : '',
      endDate: ISO_DATE.test(endDate) ? endDate : '',
    }),
    [startDate, endDate],
  );

  const { data: shifts, isLoading, refetch } = useShifts(userId, filters);
  const addShift = useAddShift();
  const deleteShift = useDeleteShift();

  const activePreset = PRESETS.find((p) => {
    const r = p.range();
    return r.start === filters.startDate && r.end === filters.endDate;
  })?.key;

  const applyPreset = useCallback((preset: (typeof PRESETS)[number]) => {
    const { start, end } = preset.range();
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Exported hours for in-progress shifts are 0.00 (legacy parity); Rate is
  // the CURRENT profile hourly_rate for every row, matching legacy behavior.
  // Legacy quirk fixed intentionally: the old export wrote the Status text
  // into the Amount column — here columns are clean and aligned.
  const exportColumns: SpreadsheetColumn<TimeEntry>[] = [
    { header: 'Date', value: (s) => formatDate(s.clock_in) },
    { header: 'Clock In', value: (s) => formatTime(s.clock_in) },
    {
      header: 'Clock Out',
      value: (s) => (s.clock_out ? formatTime(s.clock_out) : 'In progress'),
    },
    {
      header: 'Hours',
      value: (s) => getShiftHours(s.clock_in, s.clock_out).toFixed(2),
    },
    { header: 'Description', value: (s) => s.description || '-' },
    { header: 'Rate', value: () => Number(hourlyRate).toFixed(2) },
    {
      header: 'Amount',
      value: (s) => (getShiftHours(s.clock_in, s.clock_out) * hourlyRate).toFixed(2),
    },
    { header: 'Status', value: (s) => (s.paid ? 'Paid' : 'Pending') },
  ];

  const totals = useMemo(() => {
    if (!shifts?.length) return { hours: 0, amount: 0, count: 0 };
    let hours = 0;
    for (const s of shifts) {
      hours += getShiftHours(s.clock_in, s.clock_out);
    }
    return { hours, amount: hours * hourlyRate, count: shifts.length };
  }, [shifts, hourlyRate]);

  const rangeLabel = useMemo(() => {
    if (!filters.startDate && !filters.endDate) return 'All time';
    const from = filters.startDate ? formatDate(`${filters.startDate}T00:00:00`) : 'Start';
    const to = filters.endDate ? formatDate(`${filters.endDate}T00:00:00`) : 'Today';
    return `${from} – ${to}`;
  }, [filters.startDate, filters.endDate]);

  const handleAddShift = useCallback(
    async (data: { clockIn: string; clockOut: string; description?: string }) => {
      await addShift.mutateAsync({
        userId,
        clockIn: data.clockIn,
        clockOut: data.clockOut,
        description: data.description,
      });
      setShowAddModal(false);
    },
    [addShift, userId],
  );

  const renderItem = useCallback(
    ({ item }: { item: TimeEntry }) => (
      <ShiftRow
        shift={item}
        hourlyRate={hourlyRate}
        onDelete={() => deleteShift.mutate(item.id)}
        layout={isTable ? 'table' : 'card'}
      />
    ),
    [deleteShift, hourlyRate, isTable],
  );

  const tableHeader = isTable ? (
    <View style={styles.tableHeader}>
      <View style={styles.colDate}><Text style={styles.headerCell}>DATE</Text></View>
      <View style={styles.colTime}><Text style={styles.headerCell}>CLOCK IN</Text></View>
      <View style={styles.colTime}><Text style={styles.headerCell}>CLOCK OUT</Text></View>
      <View style={styles.colHours}><Text style={[styles.headerCell, styles.alignRight]}>HOURS</Text></View>
      <View style={styles.colStatus}><Text style={[styles.headerCell, styles.alignCenter]}>STATUS</Text></View>
      <View style={styles.colAmount}><Text style={[styles.headerCell, styles.alignRight]}>AMOUNT</Text></View>
      <View style={styles.colAction} />
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.container}>
        <View style={styles.viewHeader}>
          <Text style={styles.heading}>My Shifts</Text>
          <Button
            title="+ Add Manual Entry"
            variant="primary"
            size="sm"
            onPress={() => setShowAddModal(true)}
          />
        </View>

        <View style={styles.filterBar}>
          <View style={styles.presetRow}>
            {PRESETS.map((preset) => {
              const selected = activePreset === preset.key;
              return (
                <TouchableOpacity
                  key={preset.key}
                  onPress={() => applyPreset(preset)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.filterRow}>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Start date"
            />
            <Text style={styles.filterTo}>to</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              value={endDate}
              onChangeText={setEndDate}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="End date"
            />
            <CopyToSpreadsheetButton rows={shifts ?? []} columns={exportColumns} />
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryRange}>{rangeLabel}</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{totals.hours.toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>Hours</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, styles.summaryAmount]}>
                {formatCurrency(totals.amount)}
              </Text>
              <Text style={styles.summaryLabel}>Earnings</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{totals.count}</Text>
              <Text style={styles.summaryLabel}>
                {totals.count === 1 ? 'Shift' : 'Shifts'}
              </Text>
            </View>
          </View>
        </View>

        <FlatList
          data={shifts ?? []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={tableHeader}
          contentContainerStyle={
            shifts?.length ? (isTable ? undefined : styles.cardList) : styles.emptyContainer
          }
          ItemSeparatorComponent={isTable ? undefined : () => <View style={styles.cardGap} />}
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState title="No shifts found" message="Add a shift or adjust your date filters" />
            ) : null
          }
          refreshing={isLoading}
          onRefresh={refetch}
          stickyHeaderIndices={isTable ? [0] : undefined}
        />

        <AddShiftModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddShift}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  container: {
    flex: 1,
  },
  viewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  filterBar: {
    backgroundColor: Colors.bgPanel,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  chipSelected: {
    backgroundColor: Colors.accentGlow,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.accent,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text,
    backgroundColor: Colors.bgSecondary,
  },
  filterTo: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  summary: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  summaryRange: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  summaryStat: {
    flex: 1,
  },
  summaryValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  summaryAmount: {
    color: Colors.accent,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  headerCell: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  alignRight: {
    textAlign: 'right',
  },
  alignCenter: {
    textAlign: 'center',
  },
  colDate: {
    flex: 2.2,
  },
  colTime: {
    flex: 1.6,
  },
  colHours: {
    flex: 1,
    alignItems: 'flex-end',
  },
  colStatus: {
    flex: 1.4,
    alignItems: 'center',
  },
  colAmount: {
    flex: 1.6,
    alignItems: 'flex-end',
  },
  colAction: {
    width: 32,
  },
  cardList: {
    padding: Spacing.md,
  },
  cardGap: {
    height: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
  },
});
