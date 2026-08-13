import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<string, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: Colors.accent },
    text: { color: Colors.bgPrimary },
  },
  secondary: {
    container: {
      backgroundColor: Colors.bgElevated,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    text: { color: Colors.text },
  },
  danger: {
    container: { backgroundColor: Colors.danger },
    text: { color: '#ffffff' },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: Colors.accent },
  },
};

const sizeStyles: Record<string, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
    text: { fontSize: FontSize.sm },
  },
  md: {
    container: { paddingVertical: Spacing.sm + 4, paddingHorizontal: Spacing.lg },
    text: { fontSize: FontSize.md },
  },
  lg: {
    container: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
    text: { fontSize: FontSize.lg },
  },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.base,
        v.container,
        s.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.bgPrimary : Colors.accent}
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, v.text, s.text, icon ? styles.textWithIcon : undefined]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    minHeight: 44,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
  textWithIcon: {
    marginLeft: Spacing.sm,
  },
});
