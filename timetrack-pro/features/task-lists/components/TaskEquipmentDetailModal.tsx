import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import { parseEquipmentRefs, resolvePlacement } from '@/features/equipment/refs';
import {
  FLOOR_PLAN_ASPECT,
  FLOOR_PLAN_HIGHLIGHT,
  ZONE_PHOTOS,
  getLocationLabel,
  zoneFloor,
} from '@/features/locations/zones';
import type { Equipment, StoredEquipmentRef } from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

/** The shape this modal needs off a task — satisfied by TaskListItem and by
 *  the checklist's item-with-check rows alike. */
export interface TaskEquipmentDetailItem {
  title: string;
  description?: string | null;
  location_from?: string | null;
  location_to?: string | null;
  equipment?: StoredEquipmentRef[] | null;
}

interface TaskEquipmentDetailModalProps {
  item: TaskEquipmentDetailItem | null;
  equipment: Equipment[] | undefined;
  onClose: () => void;
}

/**
 * "Where does this stuff come from, and where does it go?" — opened by tapping
 * a task. Each tagged piece of equipment gets a pickup zone and a dropoff
 * zone, and tapping either one reveals that zone's photo and the highlighted
 * floor plan so someone who has never done the task can still find the spot.
 */
export default function TaskEquipmentDetailModal({
  item,
  equipment,
  onClose,
}: TaskEquipmentDetailModalProps) {
  // Which "<equipmentId>:<from|to>" zone chip is expanded, if any.
  const [openZoneKey, setOpenZoneKey] = useState<string | null>(null);

  const refs = parseEquipmentRefs(item?.equipment);
  const equipmentById = new Map((equipment ?? []).map((eq) => [eq.id, eq]));

  const close = () => {
    setOpenZoneKey(null);
    onClose();
  };

  return (
    <Modal visible={!!item} onClose={close} title={item?.title ?? ''} size="md">
      {item?.description ? (
        <Text style={s.description}>{item.description}</Text>
      ) : null}

      {refs.length === 0 ? (
        <Text style={s.empty}>
          No equipment is linked to this task yet.
        </Text>
      ) : (
        refs.map((ref) => {
          const eq = equipmentById.get(ref.id);
          const { from, to } = resolvePlacement(ref, item);
          return (
            <View key={ref.id} style={s.card}>
              <View style={s.cardHeader}>
                {eq?.image_url ? (
                  <Image
                    source={{ uri: eq.image_url }}
                    style={s.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[s.thumb, s.thumbPlaceholder]}>
                    <Ionicons name="cube-outline" size={20} color={Colors.textMuted} />
                  </View>
                )}
                <Text style={s.equipmentName}>{eq?.name ?? 'Equipment'}</Text>
              </View>

              <ZoneStep
                icon="arrow-up-circle-outline"
                label="Get it from"
                zoneId={from}
                expanded={openZoneKey === `${ref.id}:from`}
                onToggle={() =>
                  setOpenZoneKey((k) =>
                    k === `${ref.id}:from` ? null : `${ref.id}:from`,
                  )
                }
              />
              <ZoneStep
                icon="arrow-down-circle-outline"
                label="Put it"
                zoneId={to}
                expanded={openZoneKey === `${ref.id}:to`}
                onToggle={() =>
                  setOpenZoneKey((k) => (k === `${ref.id}:to` ? null : `${ref.id}:to`))
                }
              />
            </View>
          );
        })
      )}
    </Modal>
  );
}

function ZoneStep({
  icon,
  label,
  zoneId,
  expanded,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  zoneId: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!zoneId) {
    return (
      <View style={s.step}>
        <Ionicons name={icon} size={16} color={Colors.textMuted} />
        <Text style={s.stepLabel}>{label}</Text>
        <Text style={s.stepUnset}>Not set</Text>
      </View>
    );
  }

  const floor = zoneFloor(zoneId);
  const plan = FLOOR_PLAN_HIGHLIGHT[zoneId];
  const photo = ZONE_PHOTOS[zoneId];
  const hasVisual = !!(plan && floor) || !!photo;

  return (
    <View>
      <TouchableOpacity
        style={s.step}
        onPress={onToggle}
        disabled={!hasVisual}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${getLocationLabel(zoneId)}`}
      >
        <Ionicons name={icon} size={16} color={Colors.accent} />
        <Text style={s.stepLabel}>{label}</Text>
        <Text style={s.stepZone}>{getLocationLabel(zoneId)}</Text>
        {hasVisual && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={Colors.textSecondary}
          />
        )}
      </TouchableOpacity>

      {expanded && hasVisual && (
        <View style={s.visual}>
          {plan && floor ? (
            <Image
              source={plan}
              style={[s.plan, { aspectRatio: FLOOR_PLAN_ASPECT[floor] }]}
              resizeMode="contain"
            />
          ) : null}
          {photo ? <Image source={photo} style={s.photo} resizeMode="cover" /> : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  description: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  stepLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepZone: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  stepUnset: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  visual: {
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  plan: {
    width: '100%',
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
});
