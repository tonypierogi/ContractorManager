import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAllInvoices, useGenerateInvoice } from '@/hooks/useInvoices';
import { useTeamMembers } from '@/features/team/hooks';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

const PAYMENT_TERMS = [
  { label: 'Due on Receipt', value: '0' },
  { label: 'Net 15', value: '15' },
  { label: 'Net 30', value: '30' },
  { label: 'Net 45', value: '45' },
  { label: 'Net 60', value: '60' },
];

function statusBadgeColors(status: string) {
  switch (status) {
    case 'paid':
      return { bg: 'rgba(16,185,129,0.15)', fg: Colors.success };
    case 'sent':
      return { bg: 'rgba(245,158,11,0.2)', fg: Colors.warning };
    case 'cancelled':
      return { bg: 'rgba(244,63,94,0.2)', fg: Colors.danger };
    default:
      return { bg: 'rgba(100,116,139,0.2)', fg: Colors.textMuted };
  }
}

export default function AdminInvoicesScreen() {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30');
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [showTermsPicker, setShowTermsPicker] = useState(false);

  const { data: members } = useTeamMembers();
  const { data: invoices, isLoading } = useAllInvoices();
  const generateInvoice = useGenerateInvoice();
  const { showToast } = useToast();

  const selectedMember = members?.find((m) => m.id === selectedEmployee);
  const selectedTermsLabel =
    PAYMENT_TERMS.find((t) => t.value === paymentTerms)?.label ?? 'Net 30';

  const handleGenerate = () => {
    if (!selectedEmployee || !startDate || !endDate) {
      Alert.alert('Missing Fields', 'Please select an employee and date range.');
      return;
    }
    generateInvoice.mutate(
      {
        userId: selectedEmployee,
        periodStart: startDate,
        periodEnd: endDate,
      },
      {
        onSuccess: (invoice) => {
          setStartDate('');
          setEndDate('');
          showToast(`Invoice ${invoice.invoice_number} generated`);
        },
        // errors surface via the global mutation error toast
      },
    );
  };

  const getEmployeeName = useCallback((invoice: any) => {
    const p = invoice.profiles;
    if (!p) return 'Unknown';
    return (
      [p.first_name, p.last_name].filter(Boolean).join(' ') ||
      p.email ||
      'Unknown'
    );
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.viewHeader}>Generate Invoice</Text>

        <View style={styles.panelRow}>
          {/* Generator Panel */}
          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <View style={styles.accentDot} />
              <Text style={styles.sectionTitle}>Select Employee &amp; Period</Text>
            </View>

            <View style={styles.formGrid}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>EMPLOYEE</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowEmployeePicker(true)}
                >
                  <Text
                    style={
                      selectedMember ? styles.pickerText : styles.pickerPlaceholder
                    }
                    numberOfLines={1}
                  >
                    {selectedMember
                      ? [selectedMember.first_name, selectedMember.last_name]
                          .filter(Boolean)
                          .join(' ') || selectedMember.email
                      : 'Select Employee'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.formField}>
                <Input
                  label="Period Start"
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>

              <View style={styles.formField}>
                <Input
                  label="Period End"
                  placeholder="YYYY-MM-DD"
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>PAYMENT TERMS</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowTermsPicker(true)}
                >
                  <Text style={styles.pickerText}>{selectedTermsLabel}</Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.generateBtnContainer}>
              <Button
                title="Generate Invoice"
                onPress={handleGenerate}
                loading={generateInvoice.isPending}
              />
            </View>
          </View>

          {/* Recent Invoices Panel */}
          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <View style={styles.accentDot} />
              <Text style={styles.sectionTitle}>Recent Invoices</Text>
            </View>

            {invoices && invoices.length > 0 ? (
              <View style={styles.invoiceList}>
                {invoices.map((invoice: any) => {
                  const badge = statusBadgeColors(invoice.status);
                  return (
                    <View key={invoice.id} style={styles.invoiceCard}>
                      <View style={styles.invoiceHeaderRow}>
                        <Text style={styles.invoiceNumber} numberOfLines={1}>
                          {invoice.invoice_number}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: badge.bg },
                          ]}
                        >
                          <Text style={[styles.statusText, { color: badge.fg }]}>
                            {invoice.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.invoiceEmployee}>
                        {getEmployeeName(invoice)}
                      </Text>
                      {invoice.period_start && invoice.period_end && (
                        <Text style={styles.invoiceDetail}>
                          {formatDate(invoice.period_start)} –{' '}
                          {formatDate(invoice.period_end)}
                        </Text>
                      )}
                      <Text style={styles.invoiceDetail}>
                        Due: {formatDate(invoice.due_date)}
                      </Text>
                      <Text style={styles.invoiceAmount}>
                        {formatCurrency(invoice.total)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No invoices yet</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Employee Picker Modal */}
      <Modal
        visible={showEmployeePicker}
        onClose={() => setShowEmployeePicker(false)}
        title="Select Employee"
      >
        {(members ?? []).map((member) => (
          <TouchableOpacity
            key={member.id}
            style={[
              styles.pickerItem,
              member.id === selectedEmployee && styles.pickerItemSelected,
            ]}
            onPress={() => {
              setSelectedEmployee(member.id);
              setShowEmployeePicker(false);
            }}
          >
            <Text style={styles.pickerItemText}>
              {[member.first_name, member.last_name].filter(Boolean).join(' ') ||
                member.email}
            </Text>
          </TouchableOpacity>
        ))}
      </Modal>

      {/* Payment Terms Picker Modal */}
      <Modal
        visible={showTermsPicker}
        onClose={() => setShowTermsPicker(false)}
        title="Payment Terms"
        size="sm"
      >
        {PAYMENT_TERMS.map((term) => (
          <TouchableOpacity
            key={term.value}
            style={[
              styles.pickerItem,
              term.value === paymentTerms && styles.pickerItemSelected,
            ]}
            onPress={() => {
              setPaymentTerms(term.value);
              setShowTermsPicker(false);
            }}
          >
            <Text style={styles.pickerItemText}>{term.label}</Text>
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
  scroll: {
    paddingBottom: Spacing.xxl,
  },
  viewHeader: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  panelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flex: 1,
    minWidth: 300,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  formField: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 200,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    marginBottom: Spacing.md,
  },
  pickerText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  pickerPlaceholder: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    flex: 1,
  },
  generateBtnContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  invoiceList: {
    gap: Spacing.md,
  },
  invoiceCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  invoiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  invoiceNumber: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  invoiceEmployee: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  invoiceDetail: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  invoiceAmount: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.accent,
    marginTop: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
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
