import { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Badge from '@/components/ui/Badge';
import Lightbox from '@/components/ui/Lightbox';
import { useAuth } from '@/features/auth/auth-provider';
import { useLinkedTaskLists } from '@/features/locations/hooks';
import {
  LOCATION_ZONES,
  ZONE_OVERLAYS,
  FLOOR_PLAN_ASPECT,
  FLOOR_PLAN_DEFAULT,
  FLOOR_PLAN_HIGHLIGHT,
  ZONE_PHOTOS,
  type Floor,
} from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';

const FLOORS: { key: Floor; label: string }[] = [
  { key: 'upstairs', label: 'Upstairs' },
  { key: 'downstairs', label: 'Downstairs' },
];

/**
 * Room list up top, then the floor plan side by side with the selected
 * room's photo. Selecting a room (from the list or from the plan itself)
 * highlights it on the plan and swaps in its photo + linked tasks.
 */
export default function VenueFloorPlansTab() {
  const router = useRouter();
  const { role } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [floor, setFloor] = useState<Floor>('upstairs');
  const [selected, setSelected] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const zones = LOCATION_ZONES[floor];
  const overlays = ZONE_OVERLAYS[floor];
  const aspectRatio = FLOOR_PLAN_ASPECT[floor];

  const floorPlanSource =
    selected != null
      ? FLOOR_PLAN_HIGHLIGHT[selected] ?? FLOOR_PLAN_DEFAULT[floor]
      : FLOOR_PLAN_DEFAULT[floor];

  const selectedZone = selected ? zones.find((z) => z.id === selected) ?? null : null;
  const selectedPhoto = selected ? ZONE_PHOTOS[selected] : undefined;

  const linkedQuery = useLinkedTaskLists(selected);

  // The plan PNGs are tall and narrow (311x1024), so size them from a
  // height budget and let the photo pane take the remaining width.
  const contentWidth = width - Spacing.lg * 2;
  const planWidth = Math.min(
    (isWide ? 560 : 380) * aspectRatio,
    (contentWidth - Spacing.md) * (isWide ? 0.4 : 0.45),
  );
  const planHeight = planWidth / aspectRatio;

  const selectFloor = (f: Floor) => {
    setFloor(f);
    // Switching floors clears the selection (legacy parity).
    setSelected(null);
  };

  const toggleZone = (zoneId: string) => {
    setSelected((prev) => (prev === zoneId ? null : zoneId));
  };

  const openTaskList = (id: string) => {
    // Same detail screen for both roles (legacy parity) — employees reach it
    // via their own route group since (admin) redirects non-admins.
    router.push(
      (role === 'admin'
        ? `/(admin)/task-lists/${id}`
        : `/(employee)/task-lists/${id}`) as any,
    );
  };

  const roomList = (
    <View style={s.roomList}>
      {zones.map((zone) => {
        const isActive = selected === zone.id;
        return (
          <Pressable
            key={zone.id}
            onPress={() => toggleZone(zone.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              s.roomChip,
              isActive && s.roomChipActive,
              pressed && s.roomChipPressed,
            ]}
          >
            <View style={[s.zoneDot, isActive && s.zoneDotActive]} />
            <Text style={[s.roomChipLabel, isActive && s.roomChipLabelActive]} numberOfLines={1}>
              {zone.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const floorPlan = (
    <View style={[s.floorPlanWrap, { width: planWidth, height: planHeight }]}>
      <Image
        source={floorPlanSource}
        style={s.floorPlanImage}
        resizeMode="contain"
        accessibilityLabel={`${floor} floor plan`}
      />
      {overlays.map((ov) => {
        const zone = zones.find((z) => z.id === ov.id);
        if (!zone) return null;
        const isActive = selected === ov.id;
        return (
          <Pressable
            key={ov.id}
            onPress={() => toggleZone(ov.id)}
            accessibilityRole="button"
            accessibilityLabel={zone.label}
            style={[
              s.zoneOverlay,
              {
                top: `${ov.top}%`,
                left: `${ov.left}%`,
                width: `${ov.width}%`,
                height: `${ov.height}%`,
              },
              isActive && s.zoneOverlayActive,
            ]}
          >
            <Text style={s.zoneOverlayLabel} numberOfLines={1}>
              {zone.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const detailPane = (
    <View style={s.detailPane}>
      {selectedZone == null ? (
        <View style={s.emptyPane}>
          <Ionicons name="map-outline" size={28} color={Colors.textMuted} />
          <Text style={s.emptyPaneText}>Pick a room to see its photo and tasks</Text>
        </View>
      ) : (
        <>
          <Text style={s.detailTitle} numberOfLines={1}>
            {selectedZone.label}
          </Text>

          {selectedPhoto ? (
            <Pressable
              onPress={() => setLightboxOpen(true)}
              accessibilityRole="imagebutton"
              accessibilityLabel={selectedZone.label}
            >
              <Image source={selectedPhoto} style={s.zonePhoto} resizeMode="cover" />
            </Pressable>
          ) : (
            <View style={s.photoPlaceholder}>
              <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
              <Text style={s.photoPlaceholderText}>No photo for this room</Text>
            </View>
          )}

          {linkedQuery.isLoading ? (
            <Text style={s.tasksLoading}>Loading tasks...</Text>
          ) : linkedQuery.isError ? (
            <Text style={s.tasksError}>Couldn't load tasks. Please try again.</Text>
          ) : !linkedQuery.data || linkedQuery.data.length === 0 ? null : (
            <View style={s.tasksPanel}>
              <View style={s.tasksHeader}>
                <Ionicons name="document-text-outline" size={14} color={Colors.textSecondary} />
                <Text style={s.tasksHeaderText}>Tasks for {selectedZone.label}</Text>
              </View>
              {linkedQuery.data.map((task) => (
                <Pressable
                  key={task.id}
                  onPress={() => openTaskList(task.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.taskRow, pressed && s.taskRowPressed]}
                >
                  <View style={s.taskRowTop}>
                    <Text style={s.taskTitle} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Badge
                      label={task.isSop ? 'SOP' : 'Task'}
                      variant={task.isSop ? 'info' : 'default'}
                    />
                  </View>
                  <Text style={s.taskMeta}>
                    {task.itemCount} item{task.itemCount !== 1 ? 's' : ''}
                    {task.assignedCount > 0 ? ` · ${task.assignedCount} assigned` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );

  return (
    <>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.floorTabs}>
          {FLOORS.map((f) => {
            const isActive = floor === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => selectFloor(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[s.floorTab, isActive && s.floorTabActive]}
              >
                <Text style={[s.floorTabLabel, isActive && s.floorTabLabelActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {roomList}

        <View style={s.planRow}>
          {floorPlan}
          {detailPane}
        </View>
      </ScrollView>

      {selected && selectedPhoto ? (
        <Lightbox
          images={[selectedPhoto]}
          visible={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  floorTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  floorTab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
    minHeight: 40,
    justifyContent: 'center',
  },
  floorTabActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  floorTabLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  floorTabLabelActive: {
    color: Colors.accent,
  },
  roomList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
    minHeight: 44,
    ...Shadows.sm,
  },
  roomChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  roomChipPressed: {
    backgroundColor: Colors.bgElevated,
  },
  roomChipLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  roomChipLabelActive: {
    color: Colors.accent,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  zoneDotActive: {
    backgroundColor: Colors.accent,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  floorPlanWrap: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  floorPlanImage: {
    width: '100%',
    height: '100%',
  },
  zoneOverlay: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 4,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 2,
  },
  zoneOverlayActive: {
    borderWidth: 2,
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  zoneOverlayLabel: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: 'rgba(10, 15, 26, 0.65)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  detailPane: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.sm,
  },
  detailTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyPane: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyPaneText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  zonePhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  photoPlaceholderText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  tasksLoading: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  tasksError: {
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  tasksPanel: {
    gap: 2,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  tasksHeaderText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskRow: {
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  taskRowPressed: {
    backgroundColor: Colors.bgElevated,
  },
  taskRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  taskTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  taskMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
