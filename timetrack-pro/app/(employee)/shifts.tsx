import { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ShiftRow from '@/components/shifts/ShiftRow';
import AddShiftModal from '@/components/shifts/AddShiftModal';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/auth-provider';
import { useShifts, useAddShift, useDeleteShift } from '@/hooks/useShifts';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import type { TimeEntry } from '@/types/database';

function getShiftHours(clockIn: string, clockOut: string | null): number {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  return (end - start) / 3600000;
}

export default function ShiftsScreen() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? '';
  const hourlyRate = profile?.hourly_rate ?? 0;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: shifts, isLoading, refetch } = useShifts(userId, { startDate, endDate });
  const addShift = useAddShift();
  const deleteShift = useDeleteShift();

  const totals = useMemo(() => {
    if (!shifts?.length) return { hours: 0, amount: 0 };
    let hours = 0;
    for (const s of shifts) {
      hours += getShiftHours(s.clock_in, s.clock_out);
    }
    return { hours, amount: hours * hourlyRate };
  }, [shifts, hourlyRate]);

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
      />
    ),
    [deleteShift, hourlyRate],
  );

  const tableHeader = (
    <View style={styles.tableHeader}>
      <View style={styles.colDate}><Text style={styles.headerCell}>DATE</Text></View>
      <View style={styles.colTime}><Text style={styles.headerCell}>CLOCK IN</Text></View>
      <View style={styles.colTime}><Text style={styles.headerCell}>CLOCK OUT</Text></View>
      <View style={styles.colHours}><Text style={[styles.headerCell, styles.alignRight]}>HOURS</Text></View>
      <View style={styles.colStatus}><Text style={[styles.headerCell, styles.alignCenter]}>STATUS</Text></View>
      <View style={styles.colAmount}><Text style={[styles.headerCell, styles.alignRight]}>AMOUNT</Text></View>
      <View style={styles.colAction} />
    </View>
  );

  const tableFooter = shifts?.length ? (
    <View style={styles.totalsRow}>
      <Text style={styles.totalsLabel}>Period Total:</Text>
      <Text style={styles.totalsHours}>{totals.hours.toFixed(1)} hrs</Text>
      <Text style={styles.totalsAmount}>{formatCurrency(totals.amount)}</Text>
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
          <View style={styles.filterRow}>
            <View style={styles.dateField}>
              <Input
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <Text style={styles.filterTo}>to</Text>
            <View style={styles.dateField}>
              <Input
                placeholder="YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
            <Button
              title="Filter"
              variant="secondary"
              size="sm"
              onPress={() => refetch()}
            />
          </View>
        </View>

        <FlatList
          data={shifts ?? []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={tableHeader}
          ListFooterComponent={tableFooter}
          contentContainerStyle={shifts?.length ? undefined : styles.emptyContainer}
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState title="No shifts found" message="Add a shift or adjust your date filters" />
            ) : null
          }
          refreshing={isLoading}
          onRefresh={refetch}
          stickyHeaderIndices={[0]}
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
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  filterTo: {
    fontSize: FontSize.sm,
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
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgPanel,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  totalsLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  totalsHours: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  totalsAmount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },
  emptyContainer: {
    flex: 1,
  },
});
