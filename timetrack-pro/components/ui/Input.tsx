import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardTypeOptions,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
  /** Starting height for a multiline field; it grows with the text from here. */
  minHeight?: number;
}

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry,
  keyboardType,
  multiline = false,
  editable = true,
  minHeight,
}: InputProps) {
  // Grow with the content so long descriptions are fully visible instead of
  // being clipped or hidden behind an inner scroll.
  const [contentHeight, setContentHeight] = useState(0);
  const base = minHeight ?? (multiline ? 100 : 0);
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          multiline && { height: Math.max(base, contentHeight) },
          error ? styles.inputError : undefined,
          !editable && styles.disabled,
        ]}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
        scrollEnabled={multiline ? false : undefined}
        onContentSizeChange={
          multiline
            ? (e) => {
                // Track the measured content exactly: padding it out here fed
                // the next measurement, which on web grew the field by that
                // padding on every pass until React gave up.
                const next = e.nativeEvent.contentSize.height;
                setContentHeight((prev) => (Math.abs(prev - next) <= 1 ? prev : next));
              }
            : undefined
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.bgSecondary,
  },
  multiline: {
    paddingTop: Spacing.md,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  disabled: {
    opacity: 0.7,
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
});
