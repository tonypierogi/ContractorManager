import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LOCATION_ZONES,
  getLocationLabel,
  type Floor,
  type LocationZone,
} from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface LocationZonePickerProps {
  value: string | null;
  onChange: (zoneId: string | null) => void;
  /** When false, hides the '-- No location --' option (zone is required). */
  allowNone?: boolean;
  /** Field label; pass null to hide it (caller renders its own). */
  label?: string | null;
}

const NO_LOCATION_LABEL = '-- No location --';

/**
 * RN stand-in for the legacy <select> with floor optgroups: zones grouped by
 * capitalized floor name (Upstairs/Downstairs) plus a '-- No location --'
 * default option (inventory.js:66-76).
 */
export default function LocationZonePicker({
  value,
  onChange,
  allowNone = true,
  label = 'Location',
}: LocationZonePickerProps) {
  const [open, setOpen] = useState(false);

  const floors = Object.entries(LOCATION_ZONES) as [Floor, LocationZone[]][];

  const select = (zoneId: string | null) => {
    onChange(zoneId);
    setOpen(false);
  };

  return (
    <View style={s.container}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TouchableOpacity
        style={s.field}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.7}
      >
        <Text style={[s.fieldText, !value && s.fieldPlaceholder]}>
          {value ? getLocationLabel(value) : allowNone ? NO_LOCATION_LABEL : 'Select a zone'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {open && (
        <View style={s.dropdown}>
          {allowNone && (
            <TouchableOpacity
              style={s.option}
              onPress={() => select(null)}
              activeOpacity={0.7}
            >
              <Text style={[s.optionText, s.fieldPlaceholder]}>{NO_LOCATION_LABEL}</Text>
              {!value && <Ionicons name="checkmark" size={16} color={Colors.accent} />}
            </TouchableOpacity>
          )}
          {floors.map(([floor, zones]) => (
            <View key={floor}>
              <Text style={s.groupHeader}>
                {floor.charAt(0).toUpperCase() + floor.slice(1)}
              </Text>
              {zones.map((zone) => (
                <TouchableOpacity
                  key={zone.id}
                  style={s.option}
                  onPress={() => select(zone.id)}
                  activeOpacity={0.7}
                >
                  <Text style={s.optionText}>{zone.label}</Text>
                  {value === zone.id && (
                    <Ionicons name="checkmark" size={16} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    minHeight: 44,
  },
  fieldText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  fieldPlaceholder: {
    color: Colors.textMuted,
  },
  dropdown: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    overflow: 'hidden',
  },
  groupHeader: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.bgElevated,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  optionText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
});
