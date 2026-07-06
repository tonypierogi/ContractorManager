import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Badge from '@/components/ui/Badge';
import Lightbox from '@/components/ui/Lightbox';
import { useAuth } from '@/features/auth/auth-provider';
import { useLinkedTaskLists } from '@/features/locations/hooks';
import {
  LOCATION_ZONES,
  ZONE_OVERLAYS,
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

export default function LocationsScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [floor, setFloor] = useState<Floor>('upstairs');
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const zones = LOCATION_ZONES[floor];
  const overlays = ZONE_OVERLAYS[floor];

  const floorPlanSource =
    activeZone != null
      ? FLOOR_PLAN_HIGHLIGHT[activeZone] ?? FLOOR_PLAN_DEFAULT[floor]
      : FLOOR_PLAN_DEFAULT[floor];

  // Preserve the bundled image's intrinsic aspect ratio so the
  // percentage-positioned overlays line up with the drawing.
  const aspectRatio = useMemo(() => {
    const resolved = Image.resolveAssetSource(floorPlanSource);
    return resolved && resolved.width && resolved.height
      ? resolved.width / resolved.height
      : 1;
  }, [floorPlanSource]);

  const activeLabel = activeZone ? getLocationLabel(activeZone) : null;
  const activePhoto = activeZone ? ZONE_PHOTOS[activeZone] : undefined;

  const linkedQuery = useLinkedTaskLists(activeZone);

  const selectFloor = (f: Floor) => {
    setFloor(f);
    // Switching floors clears the active zone (legacy parity).
    setActiveZone(null);
  };

  const toggleZone = (zoneId: string) => {
    setActiveZone((prev) => (prev === zoneId ? null : zoneId));
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
    <View style={[styles.floorPlanWrap, { aspectRatio }]}>
      <Image
        source={floorPlanSource}
        style={styles.floorPlanImage}
        resizeMode="contain"
        accessibilityLabel={`${floor} floor plan`}
      />
      {overlays.map((ov) => {
        const zone = zones.find((z) => z.id === ov.id);
        if (!zone) return null;
        const isActive = activeZone === ov.id;
        return (
          <Pressable
            key={ov.id}
            onPress={() => toggleZone(ov.id)}
            accessibilityRole="button"
            accessibilityLabel={zone.label}
            style={[
              styles.zoneOverlay,
              {
                top: `${ov.top}%`,
                left: `${ov.left}%`,
                width: `${ov.width}%`,
                height: `${ov.height}%`,
              },
              isActive && styles.zoneOverlayActive,
            ]}
          >
            <Text style={styles.zoneOverlayLabel} numberOfLines={1}>
              {zone.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const sidebar = (
    <View style={styles.sidebar}>
      {/* Zone buttons */}
      <View style={styles.zoneList}>
        {zones.map((zone) => {
          const isActive = activeZone === zone.id;
          return (
            <Pressable
              key={zone.id}
              onPress={() => toggleZone(zone.id)}
              accessibilityRole="button"
              style={[styles.zoneBtn, isActive && styles.zoneBtnActive]}
            >
              <View style={[styles.zoneDot, isActive && styles.zoneDotActive]} />
              <Text
                style={[styles.zoneBtnLabel, isActive && styles.zoneBtnLabelActive]}
                numberOfLines={1}
              >
                {zone.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Photo preview */}
      <View style={styles.panel}>
        {activeZone && activePhoto ? (
          <Pressable onPress={() => setLightboxOpen(true)} accessibilityRole="imagebutton">
            <Image
              source={activePhoto}
              style={styles.zonePhoto}
              resizeMode="cover"
              accessibilityLabel={activeLabel ?? activeZone}
            />
            <View style={styles.photoCaption}>
              <Text style={styles.photoCaptionText}>{activeLabel}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="location-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.photoPlaceholderText}>Tap a zone to preview</Text>
          </View>
        )}
      </View>

      {/* Linked tasks */}
      {activeZone != null && (
        <View style={[styles.panel, styles.tasksPanel]}>
          <View style={styles.tasksHeader}>
            <Ionicons name="document-text-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.tasksHeaderText}>Tasks for {activeLabel}</Text>
          </View>

          {linkedQuery.isLoading ? (
            <Text style={styles.tasksLoading}>Loading tasks...</Text>
          ) : linkedQuery.isError ? (
            <Text style={styles.tasksError}>Couldn't load tasks. Please try again.</Text>
          ) : !linkedQuery.data || linkedQuery.data.length === 0 ? (
            <Text style={styles.tasksEmpty}>
              No tasks linked to <Text style={styles.tasksEmptyStrong}>{activeLabel}</Text>
            </Text>
          ) : (
            linkedQuery.data.map((task) => (
              <Pressable
                key={task.id}
                onPress={() => openTaskList(task.id)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.taskRow, pressed && styles.taskRowPressed]}
              >
                <View style={styles.taskRowTop}>
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Badge
                    label={task.isSop ? 'SOP' : 'Task'}
                    variant={task.isSop ? 'info' : 'default'}
                  />
                </View>
                <Text style={styles.taskMeta}>
                  {task.itemCount} item{task.itemCount !== 1 ? 's' : ''}
                  {task.assignedCount > 0 ? ` · ${task.assignedCount} assigned` : ''}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.heading}>Locations</Text>
        </View>

        {/* Floor tabs */}
        <View style={styles.tabs}>
          {FLOORS.map((f) => {
            const isActive = floor === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => selectFloor(f.key)}
                accessibilityRole="button"
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={isWide ? styles.layoutWide : undefined}>
          <View style={isWide ? styles.floorPlanColumn : undefined}>{floorPlan}</View>
          <View style={isWide ? styles.sidebarColumn : undefined}>{sidebar}</View>
        </View>
      </ScrollView>

      {activeZone && activePhoto ? (
        <Lightbox
          images={[activePhoto]}
          visible={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tab: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  tabLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
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
  sidebarColumn: {
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
  sidebar: {
    gap: Spacing.md,
  },
  zoneList: {
    gap: Spacing.sm,
  },
  zoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
  },
  zoneBtnActive: {
    borderWidth: 2,
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.textMuted,
  },
  zoneDotActive: {
    backgroundColor: Colors.accent,
  },
  zoneBtnLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  zoneBtnLabelActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  zonePhoto: {
    width: '100%',
    height: 200,
  },
  photoCaption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  photoCaptionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  photoPlaceholderText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  tasksPanel: {
    padding: Spacing.md,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.sm,
  },
  tasksHeaderText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tasksLoading: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingVertical: Spacing.sm,
  },
  tasksError: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingVertical: Spacing.sm,
  },
  tasksEmpty: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    paddingVertical: Spacing.sm,
  },
  tasksEmptyStrong: {
    fontWeight: '700',
    color: Colors.text,
  },
  taskRow: {
    paddingVertical: Spacing.sm + 2,
    borderTopWidth: 1,
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
