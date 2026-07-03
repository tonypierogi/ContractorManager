import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantColors: Record<string, { bg: string; text: string }> = {
  default: { bg: Colors.bgElevated, text: Colors.textSecondary },
  success: { bg: 'rgba(16, 185, 129, 0.15)', text: Colors.success },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', text: Colors.warning },
  danger: { bg: 'rgba(244, 63, 94, 0.15)', text: Colors.danger },
  info: { bg: Colors.accentGlow, text: Colors.accent },
};

export default function Badge({ label, variant = 'default' }: BadgeProps) {
  const colors = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
