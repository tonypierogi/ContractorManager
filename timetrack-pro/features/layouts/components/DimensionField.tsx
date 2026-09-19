import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface DimensionFieldProps {
  label: string;
  /** Total inches; null while the field is empty. */
  value: number | null;
  onChange: (inches: number | null) => void;
  error?: string;
}

/**
 * A length typed the way it's measured with a tape: feet and inches in two
 * boxes. Either box may be left empty ("6 ft" or "30 in" both work); the
 * caller only ever sees the total in inches.
 */
export default function DimensionField({ label, value, onChange, error }: DimensionFieldProps) {
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');

  // Re-split when the value is changed from outside (a preset, a reset), but
  // not while typing, where "6" + "" and "6" + "0" must both stay as typed.
  useEffect(() => {
    const typed = combine(feet, inches);
    if (typed === value) return;
    if (value == null) {
      setFeet('');
      setInches('');
      return;
    }
    const ft = Math.floor(value / 12);
    const rest = value % 12;
    setFeet(ft ? String(ft) : '');
    setInches(rest || !ft ? String(rest) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (nextFeet: string, nextInches: string) => {
    setFeet(nextFeet);
    setInches(nextInches);
    onChange(combine(nextFeet, nextInches));
  };

  return (
    <View style={s.container}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <View style={[s.box, error ? s.boxError : undefined]}>
          <TextInput
            value={feet}
            onChangeText={(t) => update(digits(t), inches)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            style={s.input}
            accessibilityLabel={`${label}, feet`}
            maxLength={3}
          />
          <Text style={s.unit}>ft</Text>
        </View>
        <View style={[s.box, error ? s.boxError : undefined]}>
          <TextInput
            value={inches}
            onChangeText={(t) => update(feet, digits(t))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            style={s.input}
            accessibilityLabel={`${label}, inches`}
            maxLength={4}
          />
          <Text style={s.unit}>in</Text>
        </View>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

function digits(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

/** Feet and inches as typed -> total inches, or null when both are empty. */
function combine(feet: string, inches: string): number | null {
  if (!feet && !inches) return null;
  return (parseInt(feet || '0', 10) || 0) * 12 + (parseInt(inches || '0', 10) || 0);
}

const s = StyleSheet.create({
  container: {
    flex: 1,
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
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  boxError: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: Spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
});
