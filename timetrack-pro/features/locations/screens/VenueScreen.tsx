import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VenueItemsTab from '@/features/locations/components/VenueItemsTab';
import VenueFloorPlansTab from '@/features/locations/components/VenueFloorPlansTab';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

type VenueTab = 'items' | 'floorplans';

const TABS: { key: VenueTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'items', label: 'Equipment', icon: 'construct-outline' },
  { key: 'floorplans', label: 'Floor Plans', icon: 'map-outline' },
];

/**
 * The locations hub (formerly "Venue"): "Equipment" is the where-is-the-vacuum
 * finder over the equipment table (admins can add/edit items in place);
 * "Floor Plans" is the spatial browse view.
 * Both tabs manage their own scrolling so lists stay virtualized.
 */
export default function VenueScreen() {
  const { role } = useAuth();
  const [tab, setTab] = useState<VenueTab>('items');

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Locations & Equipment</Text>
      </View>

      <View style={styles.tabs}>
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
      </View>

      {tab === 'items' ? <VenueItemsTab canEdit={role === 'admin'} /> : <VenueFloorPlansTab />}
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
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
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
