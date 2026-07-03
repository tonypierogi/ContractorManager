import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadows } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';

interface TodayStatsProps {
  totalHours: number;
  estimatedEarnings: number;
  hourlyRate: number;
}

export default function TodayStats({ totalHours, estimatedEarnings, hourlyRate }: TodayStatsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Summary</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.value}>{totalHours.toFixed(1)}</Text>
          <Text style={styles.label}>Hours Today</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.value, styles.accentValue]}>{formatCurrency(estimatedEarnings)}</Text>
          <Text style={styles.label}>Estimated Earnings</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.value}>{formatCurrency(hourlyRate)}</Text>
          <Text style={styles.label}>Your Rate</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
    ...Shadows.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  accentValue: {
    color: Colors.accent,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
