import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DailySopSection from '@/features/sops/components/DailySopSection';
import { Colors, Spacing, FontSize } from '@/constants/theme';

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Dedicated page for today's shared SOP checklist. The Work page used to
 * render the whole checklist inline; it now shows a summary card that lands
 * here, keeping Work scannable and giving the checklist full-screen room.
 * DailySopSection owns its own data fetching — this screen just supplies the
 * chrome and scroll container.
 */
export default function SopChecklistScreen() {
  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <Text style={s.heading}>Today's SOP</Text>
        <Text style={s.subtitle}>{formatFullDate(new Date())}</Text>
        <View style={s.body}>
          <DailySopSection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,
  },
  backText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  body: {
    marginTop: Spacing.lg,
  },
});
