import { useState, useCallback, useMemo } from 'react';
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
import { useAllShifts, useToggleShiftPaid } from '@/hooks/useShifts';
import { useTeamMembers } from '@/hooks/useTeam';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatDate, formatTime, formatCurrency } from '@/utils/format';

export default function TimesheetsScreen() {
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);

  const { data: members } = useTeamMembers();
  const { data: shifts, isLoading, refetch } = useAllShifts({
    employeeId: employeeFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const togglePaid = useToggleShiftPaid();

  const selectedMember = members?.find((m) => m.id === employeeFilter);

  const getMemberName = useCallback(
    (userId: string) => {
      const m = members?.find((p) => p.id === userId);
      return m ? `${m.first_name} ${m.last_name}` : 'Unknown';
    },
    [members],
  );

  const getHourlyRate = useCallback(
    (item: any) => {
      if (item.profiles?.hourly_rate != null) return item.profiles.hourly_rate;
      const m = members?.find((p) => p.id === item.user_id);
      return m?.hourly_rate ?? 0;
    },
    [members],
  );

  const calcHours = (clockIn: string, clockOut: string | null): number => {
    if (!clockOut) return 0;
    return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
  };

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

      return (
        <View style={styles.tableRow}>
          <Text style={[styles.cell, styles.cellEmployee]} numberOfLines={1}>
            {getMemberName(item.user_id)}
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
    [getMemberName, getHourlyRate, togglePaid],
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
                : 'All Employees'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.dateField}>
            <Input
              placeholder="Start date"
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          <Text style={styles.dateSeparator}>to</Text>
          <View style={styles.dateField}>
            <Input
              placeholder="End date"
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
          <Button title="Filter" onPress={() => refetch()} variant="secondary" size="sm" />
          <Button
            title="Copy to Spreadsheet"
            onPress={() => {}}
            variant="secondary"
            size="sm"
            icon={<Ionicons name="copy-outline" size={14} color={Colors.text} />}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.cellEmployee]}>EMPLOYEE</Text>
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
        title="Select Employee"
      >
        <TouchableOpacity
          style={[styles.pickerItem, !employeeFilter && styles.pickerItemSelected]}
          onPress={() => {
            setEmployeeFilter('');
            setShowEmployeePicker(false);
          }}
        >
          <Text style={styles.pickerItemText}>All Employees</Text>
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
  tableContainer: {
    minWidth: 850,
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
