import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LocationZonePicker from '@/features/locations/components/LocationZonePicker';
import { PLAN_FLOORS, formatSize, zoneOutline, type PlanScale } from '@/features/layouts/geometry';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { PlanFloor } from '@/types/database';

export interface LayoutSettings {
  name: string;
  floor: PlanFloor;
  zone_id: string | null;
  notes: string | null;
}

interface Props {
  visible: boolean;
  title: string;
  submitLabel: string;
  /** Starting values; null starts a blank layout. */
  initial: LayoutSettings | null;
  /** Each floor's fitted scale; a floor with none can't hold a layout yet. */
  scales: Record<PlanFloor, PlanScale | null>;
  loading?: boolean;
  onSubmit: (settings: LayoutSettings) => void;
  onClose: () => void;
  /** Close and go measure the plans — offered when a floor isn't measured. */
  onMeasure?: () => void;
}

/** Name, floor, room and crew notes for a layout — to create one or edit it. */
export default function LayoutSettingsModal({
  visible,
  title,
  submitLabel,
  initial,
  scales,
  loading = false,
  onSubmit,
  onClose,
  onMeasure,
}: Props) {
  const firstMeasured = PLAN_FLOORS.find((f) => scales[f.key])?.key ?? 'upstairs';
  const [name, setName] = useState('');
  const [floor, setFloor] = useState<PlanFloor>(firstMeasured);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setFloor(initial?.floor ?? firstMeasured);
    setZoneId(initial?.zone_id ?? null);
    setNotes(initial?.notes ?? '');
    setShowErrors(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initial]);

  // Picking a room that's drawn on one floor's plan moves the layout there.
  const pickZone = (next: string | null) => {
    setZoneId(next);
    const outline = zoneOutline(next);
    if (outline) setFloor(outline.floor);
  };

  const nameError = !name.trim() ? 'Name the layout, e.g. “Theater – 80 seats”' : undefined;
  const measured = !!scales[floor];

  const submit = () => {
    if (nameError || !measured) {
      setShowErrors(true);
      return;
    }
    onSubmit({ name: name.trim(), floor, zone_id: zoneId, notes: notes.trim() || null });
  };

  return (
    <Modal visible={visible} onClose={onClose} title={title}>
      <Input
        label="Layout name"
        placeholder="e.g. Theater – 80 seats"
        value={name}
        onChangeText={setName}
        error={showErrors ? nameError : undefined}
      />

      <LocationZonePicker value={zoneId} onChange={pickZone} label="Room (optional)" />

      <Text style={s.label}>Floor plan</Text>
      <View style={s.floors}>
        {PLAN_FLOORS.map((f) => {
          const active = floor === f.key;
          const scale = scales[f.key];
          return (
            <Pressable
              key={f.key}
              onPress={() => setFloor(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[s.floor, active && s.floorActive]}
            >
              <View style={s.floorText}>
                <Text style={[s.floorName, active && s.floorNameActive]}>{f.label}</Text>
                <Text style={[s.floorMeta, !scale && s.floorMetaMissing]}>
                  {scale ? formatSize(scale.widthIn, scale.depthIn) : 'Not measured'}
                </Text>
              </View>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={active ? Colors.accent : Colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
      {!measured ? (
        <View style={s.none}>
          <Text style={s.noneText}>
            The {floor} plan has no measurement lines yet, so furniture can’t be drawn to scale on it.
          </Text>
          {onMeasure ? (
            <Button title="Measure the floor plan" variant="secondary" size="sm" onPress={onMeasure} />
          ) : null}
        </View>
      ) : null}

      <View style={s.spacer} />
      <Input
        label="Notes for the crew"
        placeholder="Aisle down the middle, leave the fire exit clear…"
        value={notes}
        onChangeText={setNotes}
        multiline
        minHeight={64}
      />

      <Button title={submitLabel} onPress={submit} loading={loading} disabled={!measured} fullWidth />
    </Modal>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  floors: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  floor: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    minHeight: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
  },
  floorActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  floorText: {
    flex: 1,
  },
  floorName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  floorNameActive: {
    color: Colors.text,
  },
  floorMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  floorMetaMissing: {
    color: Colors.warning,
  },
  none: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.warning,
    alignItems: 'flex-start',
  },
  noneText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  spacer: {
    height: Spacing.md,
  },
});
