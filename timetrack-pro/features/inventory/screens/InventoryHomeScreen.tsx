import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/auth-provider';
import { formatDate } from '@/utils/format';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useInventoryItems, useInventoryRuns } from '../hooks';
import { loadRunDraft } from '../run-draft';
import RunDetailModal from '../components/RunDetailModal';
import type { InventoryRunSummary } from '../api';

/**
 * Inventory landing page: last-run hero, start/continue entry into the
 * camera-first run flow, and run history. Replaces the old single-scroll
 * InventoryCheckScreen.
 */
export default function InventoryHomeScreen() {
  const { user } = useAuth();
  const { data: items } = useInventoryItems(true);
  const { data: runs, isLoading, isRefetching, refetch } = useInventoryRuns();
  const [draftCount, setDraftCount] = useState(0);
  const [detailRun, setDetailRun] = useState<InventoryRunSummary | null>(null);

  // Re-read the draft every time this screen regains focus so the button
  // flips between Start and Continue after a run is begun or submitted.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (user) {
        void loadRunDraft(user.id).then((draft) => {
          if (alive) setDraftCount(draft ? Object.keys(draft.checks).length : 0);
        });
      }
      return () => {
        alive = false;
      };
    }, [user]),
  );

  const totalItems = items?.length ?? 0;
  const lastRun = runs?.[0];

  const startTitle = draftCount
    ? `Continue Run (${draftCount}/${totalItems})`
    : 'Start Inventory Run';

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        <Text style={s.heading}>Inventory</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={undefined}
      >
        {isLoading ? (
          <View style={s.loading}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <>
            <View style={s.hero}>
              {lastRun ? (
                <>
                  <Text style={s.heroLabel}>Last run</Text>
                  <Text style={s.heroTitle}>
                    {formatDate(lastRun.started_at)} · {lastRun.runnerName}
                  </Text>
                  <View style={s.tallyRow}>
                    <Tally label="Plenty" count={lastRun.counts.Plenty} color={Colors.success} />
                    <Tally label="Some" count={lastRun.counts.Some} color={Colors.warning} />
                    <Tally label="OUT" count={lastRun.counts.OUT} color={Colors.danger} />
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.heroLabel}>Last run</Text>
                  <Text style={s.heroTitle}>No runs yet</Text>
                  <Text style={s.heroHint}>
                    Walk the space, snap a photo of each item, and mark its stock level.
                  </Text>
                </>
              )}
            </View>

            <Button
              title={startTitle}
              onPress={() => router.push('/(employee)/inventory/run' as any)}
              disabled={totalItems === 0}
              fullWidth
            />
            {totalItems === 0 ? (
              <Text style={s.noItemsHint}>
                Your admin hasn't added any inventory items yet.
              </Text>
            ) : null}

            <View style={s.historyHeader}>
              <Text style={s.sectionTitle}>History</Text>
              <TouchableOpacity onPress={() => refetch()} hitSlop={8}>
                <Ionicons
                  name="refresh"
                  size={16}
                  color={isRefetching ? Colors.textMuted : Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {!runs?.length ? (
              <EmptyState
                icon="\u{1F4CB}"
                title="No inventory runs yet"
                message="Completed runs will show up here."
              />
            ) : (
              runs.map((run) => (
                <TouchableOpacity
                  key={run.id}
                  style={s.historyRow}
                  onPress={() => setDetailRun(run)}
                  activeOpacity={0.7}
                >
                  <View style={s.historyLeft}>
                    <Text style={s.historyDate}>{formatDate(run.started_at)}</Text>
                    <Text style={s.historyRunner}>{run.runnerName}</Text>
                  </View>
                  <View style={s.historyRight}>
                    <Text style={s.historyCount}>{run.totalChecks} items</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>

      <RunDetailModal run={detailRun} onClose={() => setDetailRun(null)} />
    </SafeAreaView>
  );
}

function Tally({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={s.tally}>
      <Text style={[s.tallyCount, { color }]}>{count}</Text>
      <Text style={s.tallyLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  loading: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  hero: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  heroHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  tallyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  tally: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  tallyCount: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  tallyLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  noItemsHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  historyLeft: {
    flex: 1,
  },
  historyDate: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },
  historyRunner: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  historyCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
