import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, Shadows, BorderRadius } from '@/constants/theme';

interface ClockButtonProps {
  isClockedIn: boolean;
  onPress: () => void;
  loading?: boolean;
}

export default function ClockButton({ isClockedIn, onPress, loading = false }: ClockButtonProps) {
  const bg = isClockedIn ? Colors.danger : Colors.success;
  const iconChar = isClockedIn ? '\u25A0' : '\u25B6';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
      style={[styles.button, { backgroundColor: bg }, loading && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <View style={styles.content}>
          <Text style={styles.icon}>{iconChar}</Text>
          <Text style={styles.label}>{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 140,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  disabled: {
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    color: '#fff',
    fontSize: FontSize.md,
  },
  label: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});
