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
  getLocationLabel,
  type Floor,
} from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';

const FLOORS: { key: Floor; label: string }[] = [
  { key: 'upstairs', label: 'Upstairs' },
  { key: 'downstairs', label: 'Downstairs' },
];

/**
 * Floor plan up top, expandable section list below. Expanding a section
 * highlights it on the plan and reveals its reference photo + linked tasks.
 */
export default function VenueFloorPlansTab() {
  const router = useRouter();
  const { role } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [floor, setFloor] = useState<Floor>('upstairs');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const zones = LOCATION_ZONES[floor];
  const overlays = ZONE_OVERLAYS[floor];
  const aspectRatio = FLOOR_PLAN_ASPECT[floor];

  const floorPlanSource =
    expanded != null
      ? FLOOR_PLAN_HIGHLIGHT[expanded] ?? FLOOR_PLAN_DEFAULT[floor]
      : FLOOR_PLAN_DEFAULT[floor];

  const expandedLabel = expanded ? getLocationLabel(expanded) : null;
  const expandedPhoto = expanded ? ZONE_PHOTOS[expanded] : undefined;

  const linkedQuery = useLinkedTaskLists(expanded);

  const selectFloor = (f: Floor) => {
    setFloor(f);
    // Switching floors clears the expanded zone (legacy parity).
    setExpanded(null);
  };

  const toggleZone = (zoneId: string) => {
    setExpanded((prev) => (prev === zoneId ? null : zoneId));
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

  const floorPlan = (
    <View style={[s.floorPlanWrap, { aspectRatio }]}>
      <Image
        source={floorPlanSource}
        style={s.floorPlanImage}
        resizeMode="contain"
        accessibilityLabel={`${floor} floor plan`}
      />
      {overlays.map((ov) => {
        const zone = zones.find((z) => z.id === ov.id);
        if (!zone) return null;
        const isActive = expanded === ov.id;
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

  const sections = (
    <View style={s.sectionList}>
      {zones.map((zone) => {
        const isOpen = expanded === zone.id;
        return (
          <View key={zone.id} style={[s.section, isOpen && s.sectionOpen]}>
            <Pressable
              onPress={() => toggleZone(zone.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={({ pressed }) => [s.sectionHeader, pressed && s.sectionHeaderPressed]}
            >
              <View style={[s.zoneDot, isOpen && s.zoneDotActive]} />
              <Text style={[s.sectionTitle, isOpen && s.sectionTitleActive]} numberOfLines={1}>
                {zone.label}
              </Text>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={isOpen ? Colors.accent : Colors.textMuted}
              />
            </Pressable>

            {isOpen && (
              <View style={s.sectionBody}>
                {expandedPhoto ? (
                  <Pressable
                    onPress={() => setLightboxOpen(true)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={zone.label}
                  >
                    <Image source={expandedPhoto} style={s.zonePhoto} resizeMode="cover" />
                  </Pressable>
                ) : (
                  <View style={s.photoPlaceholder}>
                    <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                    <Text style={s.photoPlaceholderText}>No photo for this section</Text>
                  </View>
                )}

                {linkedQuery.isLoading ? (
                  <Text style={s.tasksLoading}>Loading tasks...</Text>
                ) : linkedQuery.isError ? (
                  <Text style={s.tasksError}>Couldn't load tasks. Please try again.</Text>
                ) : !linkedQuery.data || linkedQuery.data.length === 0 ? null : (
                  <View style={s.tasksPanel}>
                    <View style={s.tasksHeader}>
                      <Ionicons
                        name="document-text-outline"
                        size={14}
                        color={Colors.textSecondary}
                      />
                      <Text style={s.tasksHeaderText}>Tasks for {zone.label}</Text>
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
                          {task.assignedCount > 0
                            ? ` · ${task.assignedCount} assigned`
                            : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
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

        <View style={isWide ? s.layoutWide : undefined}>
          <View style={isWide ? s.floorPlanColumn : undefined}>{floorPlan}</View>
          <View style={isWide ? s.sectionColumn : undefined}>{sections}</View>
        </View>
      </ScrollView>

      {expanded && expandedPhoto ? (
        <Lightbox
          images={[expandedPhoto]}
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
  layoutWide: {
    flexDirection: 'row',
    gap: Spacing.lg,
    alignItems: 'flex-start',
  },
  floorPlanColumn: {
    flex: 3,
  },
  sectionColumn: {
    flex: 2,
  },
  floorPlanWrap: {
    width: '100%',
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
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
  sectionList: {
    gap: Spacing.sm,
  },
  section: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  sectionOpen: {
    borderColor: Colors.accent,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 48,
  },
  sectionHeaderPressed: {
    backgroundColor: Colors.bgElevated,
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
  sectionTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionTitleActive: {
    color: Colors.accent,
  },
  sectionBody: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  zonePhoto: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  photoPlaceholder: {
    height: 120,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  photoPlaceholderText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
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
