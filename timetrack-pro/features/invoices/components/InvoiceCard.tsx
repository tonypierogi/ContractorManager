import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadows } from '@/constants/theme';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Invoice, InvoiceStatus } from '@/types/database';

interface InvoiceCardProps {
  invoice: Invoice;
  onPress?: () => void;
}

const statusStyles: Record<InvoiceStatus, { bg: string; color: string }> = {
  draft: { bg: 'rgba(100,116,139,0.2)', color: Colors.textMuted },
  sent: { bg: 'rgba(245,158,11,0.2)', color: Colors.warning },
  paid: { bg: 'rgba(16,185,129,0.15)', color: Colors.success },
  cancelled: { bg: 'rgba(244,63,94,0.2)', color: Colors.danger },
};

export default function InvoiceCard({ invoice, onPress }: InvoiceCardProps) {
  const badge = statusStyles[invoice.status];

  const periodText =
    invoice.period_start && invoice.period_end
      ? `Period: ${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}`
      : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <Text style={styles.number} numberOfLines={1}>
          {invoice.invoice_number}
        </Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>
            {invoice.status}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        {periodText && <Text style={styles.detailText}>{periodText}</Text>}
        <Text style={styles.detailText}>Due: {formatDate(invoice.due_date)}</Text>
      </View>

      <Text style={styles.amount}>{formatCurrency(invoice.total)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  number: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    flexShrink: 1,
  },
  badge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
  },
  details: {
    marginTop: Spacing.sm,
  },
  detailText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  amount: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
    marginTop: Spacing.sm,
  },
});
