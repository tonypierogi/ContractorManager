import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import VenueItemsTab from '@/features/locations/components/VenueItemsTab';
import VenueFloorPlansTab from '@/features/locations/components/VenueFloorPlansTab';
import LayoutsTab from '@/features/layouts/components/LayoutsTab';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

type VenueTab = 'items' | 'floorplans' | 'layouts';

const TABS: { key: VenueTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'items', label: 'Equipment', icon: 'construct-outline' },
  { key: 'floorplans', label: 'Floor Plans', icon: 'map-outline' },
  { key: 'layouts', label: 'Layouts', icon: 'grid-outline' },
];

function isVenueTab(value: string | undefined): value is VenueTab {
  return TABS.some((t) => t.key === value);
}

/**
 * The locations hub (formerly "Venue"): "Equipment" is the where-is-the-vacuum
 * finder over the equipment table (admins can add/edit items in place);
 * "Floor Plans" is the spatial browse view; "Layouts" holds furniture setups
 * drawn to scale. All tabs manage their own scrolling so lists stay virtualized.
 *
 * The tab lives in the URL (?tab=layouts) so coming back from a layout lands
 * on the Layouts tab rather than resetting to Equipment.
 */
export default function VenueScreen() {
  const { role } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTabState] = useState<VenueTab>(isVenueTab(params.tab) ? params.tab : 'items');
  const setTab = (next: VenueTab) => {
    setTabState(next);
    router.setParams({ tab: next });
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Locations & Equipment</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroller}
        contentContainerStyle={styles.tabs}
      >
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Ionicons
                name={t.icon}
                size={15}
                color={isActive ? Colors.accent : Colors.textSecondary}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'items' ? (
        <VenueItemsTab canEdit={role === 'admin'} />
      ) : tab === 'floorplans' ? (
        <VenueFloorPlansTab />
      ) : (
        <LayoutsTab canEdit={role === 'admin'} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  // Three pills overflow a small phone, so the row scrolls instead of wrapping.
  tabsScroller: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: Spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
});
