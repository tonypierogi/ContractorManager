import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet from '@/components/ui/Sheet';
import Lightbox from '@/components/ui/Lightbox';
import {
  EQUIPMENT_MODE_DESCRIPTION,
  EQUIPMENT_MODE_LABEL,
  EQUIPMENT_ZONE_LABEL,
  parseEquipmentRefs,
  resolvePlacement,
} from '@/features/equipment/refs';
import { useZoneOverrides } from '@/features/locations/hooks';
import {
  FLOOR_PLAN_ASPECT,
  FLOOR_PLAN_HIGHLIGHT,
  formatZoneSpan,
  getLocationLabel,
  getZonePhoto,
  zoneFloor,
} from '@/features/locations/zones';
import type {
  Equipment,
  EquipmentLinkMode,
  StoredEquipmentRef,
} from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

/** The shape this sheet needs off a task — satisfied by TaskListItem, SopItem,
 *  and the checklist's item-with-check rows alike. */
export interface TaskDetailItem {
  title: string;
  description?: string | null;
  media?: unknown;
  location_from?: string | null;
  location_to?: string | null;
  equipment?: StoredEquipmentRef[] | null;
}

interface TaskDetailSheetProps {
  item: TaskDetailItem | null;
  equipment: Equipment[] | undefined;
  onClose: () => void;
}

/** Photo URLs off a task's media (walkthrough videos live elsewhere). */
function imageUrls(media: unknown): string[] {
  if (!Array.isArray(media)) return [];
  return media
    .filter((m: any) => m?.url && !String(m.type ?? '').startsWith('video'))
    .map((m: any) => m.url as string);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Legacy SOP rows stored equipment names instead of ids — show those rather
 *  than a bare uuid when the id doesn't resolve. */
function equipmentLabel(id: string, eq: Equipment | undefined): string {
  if (eq) return eq.name;
  return UUID_RE.test(id) ? 'Equipment' : id;
}

/**
 * Everything about one task, opened by tapping it: its photos, what it says,
 * where it happens, and every piece of equipment with why it's linked (go get
 * it, or put it back) plus the zone photos and highlighted floor plans that
 * show someone who has never done the task where those places are.
 */
export default function TaskDetailSheet({
  item,
  equipment,
  onClose,
}: TaskDetailSheetProps) {
  // Which "<equipmentId>:<from|to>" zone row is expanded, if any.
  const [openZoneKey, setOpenZoneKey] = useState<string | null>(null);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);
  // Renamed rooms and replaced room photos show through here too.
  useZoneOverrides();

  const refs = parseEquipmentRefs(item?.equipment);
  const equipmentById = new Map((equipment ?? []).map((eq) => [eq.id, eq]));
  const images = imageUrls(item?.media);
  const taskZones = formatZoneSpan(item?.location_from, item?.location_to);

  const close = () => {
    setOpenZoneKey(null);
    setLightboxAt(null);
    onClose();
  };

  return (
    <Sheet
      visible={!!item}
      onClose={close}
      title={item?.title ?? ''}
      subtitle={taskZones}
    >
      {images.length > 0 ? (
        <>
          <TouchableOpacity
            onPress={() => setLightboxAt(0)}
            activeOpacity={0.9}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo for ${item?.title ?? 'task'}`}
          >
            <Image source={{ uri: images[0] }} style={s.hero} resizeMode="cover" />
          </TouchableOpacity>
          {images.length > 1 ? (
            <View style={s.thumbRow}>
              {images.slice(1).map((url, i) => (
                <TouchableOpacity
                  key={url + i}
                  onPress={() => setLightboxAt(i + 1)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: url }} style={s.thumb} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {item?.description ? (
        <Text style={s.description}>{item.description}</Text>
      ) : null}

      {taskZones ? (
        <View style={s.section}>
          <Text style={s.sectionLabel}>Location</Text>
          <View style={s.zoneRow}>
            <Ionicons name="location-outline" size={16} color={Colors.accent} />
            <Text style={s.zoneText}>{taskZones}</Text>
          </View>
        </View>
      ) : null}

      <View style={s.section}>
        <Text style={s.sectionLabel}>Equipment</Text>
        {refs.length === 0 ? (
          <Text style={s.empty}>No equipment is linked to this task.</Text>
        ) : (
          refs.map((ref) => {
            const eq = equipmentById.get(ref.id);
            const { from, to } = resolvePlacement(ref, item);
            const zoneLabels = EQUIPMENT_ZONE_LABEL[ref.mode];
            return (
              <View key={ref.id} style={s.card}>
                <View style={s.cardHeader}>
                  {eq?.image_url ? (
                    <Image
                      source={{ uri: eq.image_url }}
                      style={s.equipmentThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[s.equipmentThumb, s.thumbPlaceholder]}>
                      <Ionicons name="cube-outline" size={20} color={Colors.textMuted} />
                    </View>
                  )}
                  <View style={s.cardHeaderText}>
                    <Text style={s.equipmentName}>
                      {equipmentLabel(ref.id, eq)}
                    </Text>
                    <Text style={s.modeHint}>
                      {EQUIPMENT_MODE_DESCRIPTION[ref.mode]}
                    </Text>
                  </View>
                  <ModeBadge mode={ref.mode} />
                </View>

                <ZoneStep
                  icon="arrow-up-circle-outline"
                  label={zoneLabels.from}
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
                  label={zoneLabels.to}
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
      </View>

      <Lightbox
        images={images}
        startIndex={lightboxAt ?? 0}
        visible={lightboxAt != null}
        onClose={() => setLightboxAt(null)}
      />
    </Sheet>
  );
}

function ModeBadge({ mode }: { mode: EquipmentLinkMode }) {
  return (
    <View style={[s.badge, mode === 'return' && s.badgeReturn]}>
      <Text style={[s.badgeText, mode === 'return' && s.badgeTextReturn]}>
        {EQUIPMENT_MODE_LABEL[mode]}
      </Text>
    </View>
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
  const photo = getZonePhoto(zoneId);
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
  hero: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.md,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  zoneText: {
    fontSize: FontSize.md,
    color: Colors.text,
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
  cardHeaderText: {
    flex: 1,
  },
  equipmentThumb: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  modeHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentGlow,
  },
  badgeReturn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeText: {
    fontSize: FontSize.xxs,
    fontWeight: '700',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeTextReturn: {
    color: Colors.warning,
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
