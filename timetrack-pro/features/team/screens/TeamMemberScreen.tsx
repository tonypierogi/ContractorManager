import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useProfile, useUpdateProfile } from '@/features/profile/hooks';
import { useShifts } from '@/features/shifts/hooks';
import { useDeleteTeamMember } from '@/features/team/hooks';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatTime, formatDate, formatCurrency, formatAddress } from '@/utils/format';

export default function TeamMemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = id ?? '';
  const { data: member, isLoading } = useProfile(memberId);
  const { data: shifts } = useShifts(memberId);
  const updateProfile = useUpdateProfile();
  const deleteMember = useDeleteTeamMember();

  const [rate, setRate] = useState('');

  const handleSaveRate = async () => {
    if (!memberId || !rate) return;
    try {
      await updateProfile.mutateAsync({
        userId: memberId,
        updates: { hourly_rate: parseFloat(rate) } as any,
      });
      Alert.alert('Success', 'Rate updated');
    } catch {
      Alert.alert('Error', 'Failed to update rate');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Member',
      `Remove ${member?.first_name} ${member?.last_name} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMember.mutateAsync(memberId);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete member');
            }
          },
        },
      ],
    );
  };

  const recentShifts = useMemo(() => (shifts ?? []).slice(0, 10), [shifts]);

  const { totalHours, totalAmount } = useMemo(() => {
    const hrs = (shifts ?? []).reduce((sum, s) => {
      if (!s.clock_out) return sum;
      const ms = new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime();
      return sum + ms / 3_600_000;
    }, 0);
    return { totalHours: hrs, totalAmount: hrs * (member?.hourly_rate ?? 0) };
  }, [shifts, member?.hourly_rate]);

  const initials =
    ((member?.first_name?.[0] ?? '') + (member?.last_name?.[0] ?? '')).toUpperCase() || '?';

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button title="← Back" onPress={() => router.back()} variant="ghost" size="sm" />

        {/* Employee Header */}
        <View style={styles.headerPanel}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>
            {member?.first_name} {member?.last_name}
          </Text>
          <Text style={styles.email}>{member?.email}</Text>
        </View>

        {/* Active Status */}
        <View style={styles.panel}>
          <View style={styles.statusRow}>
            <View style={styles.statusText}>
              <Text style={styles.sectionTitleTight}>Active Team Member</Text>
              <Text style={styles.statusDesc}>
                Inactive members keep their history but are hidden from
                schedules, timesheets, and assignment pickers.
              </Text>
            </View>
            <Switch
              value={member?.is_active !== false}
              onValueChange={(value) =>
                updateProfile.mutate({
                  userId: memberId,
                  updates: { is_active: value },
                })
              }
              trackColor={{ false: Colors.bgElevated, true: Colors.accent }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{member?.phone || 'Not provided'}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{member?.email}</Text>
            </View>
          </View>
        </View>

        {/* Billing Address */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Billing Address</Text>
          <Text style={styles.addressText}>
            {member ? formatAddress(member) : 'Not provided'}
          </Text>
        </View>

        {/* Work Summary */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Work Summary (Last 30 Days)</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalHours.toFixed(1)} hrs</Text>
              <Text style={styles.infoLabel}>Total Hours</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.accentText]}>
                {formatCurrency(totalAmount)}
              </Text>
              <Text style={styles.infoLabel}>Total Amount</Text>
            </View>
          </View>
        </View>

        {/* Recent Shifts */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Recent Shifts</Text>
          {recentShifts.length > 0 ? (
            recentShifts.map((shift) => {
              const hours = shift.clock_out
                ? (new Date(shift.clock_out).getTime() - new Date(shift.clock_in).getTime()) / 3_600_000
                : 0;
              const earnings = hours * (member?.hourly_rate ?? 0);

              return (
                <View key={shift.id} style={styles.shiftRow}>
                  <View>
                    <Text style={styles.shiftDate}>{formatDate(shift.clock_in)}</Text>
                    <Text style={styles.shiftTime}>
                      {formatTime(shift.clock_in)}
                      {' – '}
                      {shift.clock_out ? formatTime(shift.clock_out) : 'In progress'}
                    </Text>
                  </View>
                  <View style={styles.shiftRight}>
                    <Text style={styles.shiftHours}>{hours > 0 ? `${hours.toFixed(1)} hrs` : '—'}</Text>
                    <Text style={styles.shiftEarnings}>
                      {hours > 0 ? formatCurrency(earnings) : '—'}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No shifts in the last 30 days</Text>
          )}
        </View>

        {/* Set Rate */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Set Hourly Rate</Text>
          <Input
            label="Hourly Rate ($)"
            value={rate || String(member?.hourly_rate ?? '')}
            onChangeText={setRate}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <Button
            title="Update Rate"
            onPress={handleSaveRate}
            loading={updateProfile.isPending}
          />
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Button
            title="Delete Team Member"
            onPress={handleDelete}
            variant="danger"
            fullWidth
            loading={deleteMember.isPending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    padding: Spacing.md,
  },
  headerPanel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.bgPrimary,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  email: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  sectionTitleTight: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  statusText: {
    flex: 1,
  },
  statusDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  addressText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  summaryItem: {
    flex: 1,
  },
  summaryValue: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  accentText: {
    color: Colors.accent,
  },
  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  shiftDate: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  shiftTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  shiftRight: {
    alignItems: 'flex-end',
  },
  shiftHours: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  shiftEarnings: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    marginTop: 2,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  dangerZone: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
