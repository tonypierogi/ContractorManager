import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/auth-provider';
import { useMyTaskAssignments } from '@/features/task-lists/hooks';
import {
  useCancelDailySop,
  useCompleteDailySop,
  useCreateDailySop,
  useSopChecklist,
  useSopTemplates,
  useTodayDailySops,
} from '@/features/sops/hooks';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { parseDateString, toDateString } from '@/features/schedule/lib';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** 'Aug 13' — assignments older than today read as overdue. */
function dueLabel(dateStr: string): string {
  return parseDateString(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const statusBadgeStyles: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: Colors.warning },
  in_progress: { bg: 'rgba(100,149,237,0.15)', color: '#6495ed' },
};

/**
 * Unified contractor work page: anything assigned specifically to this user
 * sits above the SOPs — the run in progress (with its cancel / mark-complete
 * controls) followed by every SOP available to start. Checklists themselves
 * open on their own dedicated page; nothing renders inline here.
 */
export default function MyWorkScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: assignments } = useMyTaskAssignments(user?.id ?? '');
  const today = toDateString(new Date());

  // Summary numbers for the SOP card; the dedicated page owns the details.
  // A day can hold several runs: the one in progress plus any already filed.
  const { data: todayRuns } = useTodayDailySops();
  const activeSop = (todayRuns ?? []).find((run: any) => !run.completed_at) ?? null;
  const completedToday = (todayRuns ?? []).filter((run: any) => !!run.completed_at);
  const { data: templates } = useSopTemplates();
  const { data: sopChecklist } = useSopChecklist(
    activeSop?.id ?? '',
    activeSop?.sop_template_id,
  );
  const createDailySop = useCreateDailySop();
  const completeDailySop = useCompleteDailySop();
  const cancelDailySop = useCancelDailySop();
  const [confirming, setConfirming] = useState<'complete' | 'cancel' | null>(null);

  const sopCheckable =
    sopChecklist?.templateItems.filter((i) => i.item_type !== 'section') ?? [];
  const sopChecked = sopCheckable.filter((i) => i.checked).length;
  const sopUnfinished = sopCheckable.length - sopChecked;
  const sopSubtitle = activeSop
    ? `${sopChecked} of ${sopCheckable.length} tasks complete`
    : "Start today's checklist";

  // Everything except the SOP already running, so it isn't listed twice.
  const startableTemplates = (templates ?? []).filter(
    (tpl: any) => tpl.id !== activeSop?.sop_template_id,
  );

  const handleStartSop = (templateId: string) => {
    if (!user || activeSop) return;
    createDailySop.mutate(
      { sopTemplateId: templateId, createdBy: user.id },
      {
        onSuccess: () => router.push('/(employee)/sop-checklist' as any),
        // The only way this fails now is a race: someone else started a
        // checklist a moment ago and this device hasn't caught up yet.
        onError: () =>
          showToast(
            'Could not start that SOP — someone may have just started one. Try again in a moment.',
            'error',
          ),
      },
    );
  };

  const handleCompleteSop = () => {
    if (!activeSop) return;
    completeDailySop.mutate(activeSop.id, {
      onSuccess: () => {
        setConfirming(null);
        showToast(
          sopUnfinished > 0
            ? `SOP marked complete with ${sopUnfinished} task${
                sopUnfinished === 1 ? '' : 's'
              } unfinished.`
            : 'SOP marked as complete!',
        );
      },
      onError: () => {
        setConfirming(null);
        showToast('Failed to mark SOP complete. Please try again.', 'error');
      },
    });
  };

  const handleCancelSop = () => {
    if (!activeSop) return;
    cancelDailySop.mutate(activeSop.id, {
      onSuccess: () => {
        setConfirming(null);
        showToast('SOP cancelled.');
      },
      onError: (err: any) => {
        setConfirming(null);
        showToast(err?.message ?? 'Failed to cancel SOP.', 'error');
      },
    });
  };

  const active =
    assignments?.filter(
      (a: any) => a.status === 'pending' || a.status === 'in_progress',
    ) ?? [];

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        <Text style={s.heading}>My Work</Text>
        <Text style={s.subtitle}>{formatFullDate(new Date())}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {active.length > 0 && (
          <View style={s.assignedSection}>
            <View style={s.sectionHeader}>
              <View style={s.accentDot} />
              <Text style={s.sectionTitle}>Assigned to you</Text>
            </View>

            <View style={s.cardList}>
              {active.map((item: any) => {
                const badge =
                  statusBadgeStyles[item.status] ?? statusBadgeStyles.pending;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={s.card}
                    onPress={() =>
                      router.push(`/(employee)/task-checklist/${item.id}` as any)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={s.cardLeft}>
                      <Text style={s.cardTitle}>
                        {item.task_lists?.title ?? 'Task list'}
                      </Text>
                      {item.task_lists?.description ? (
                        <Text style={s.cardDesc} numberOfLines={2}>
                          {item.task_lists.description}
                        </Text>
                      ) : null}
                      <View style={s.badgeRow}>
                        <View style={[s.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[s.badgeText, { color: badge.color }]}>
                            {item.status === 'in_progress'
                              ? 'In Progress'
                              : item.status}
                          </Text>
                        </View>
                        {item.due_date ? (
                          <View
                            style={[
                              s.badge,
                              {
                                backgroundColor:
                                  item.due_date < today
                                    ? 'rgba(244,63,94,0.15)'
                                    : 'rgba(255,255,255,0.06)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                s.badgeText,
                                {
                                  color:
                                    item.due_date < today
                                      ? Colors.danger
                                      : Colors.textSecondary,
                                },
                              ]}
                            >
                              {item.due_date === today
                                ? 'Due today'
                                : `Due ${dueLabel(item.due_date)}`}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Text style={s.chevron}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={s.sectionHeader}>
          <View style={s.accentDot} />
          <Text style={s.sectionTitle}>SOPs</Text>
        </View>

        {activeSop ? (
          <View style={s.sopActiveBlock}>
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push('/(employee)/sop-checklist' as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open today's SOP checklist"
            >
              <View style={s.cardLeft}>
                <Text style={s.cardTitle}>
                  {activeSop.sop_templates?.name ?? "Today's SOP"}
                </Text>
                <Text style={s.cardDesc}>{sopSubtitle}</Text>
                {sopCheckable.length > 0 ? (
                  <View style={s.sopProgressTrack}>
                    <View
                      style={[
                        s.sopProgressFill,
                        {
                          width: `${Math.round(
                            (sopChecked / sopCheckable.length) * 100,
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>

            <View style={s.sopActions}>
              <Button
                title="Cancel SOP"
                variant="danger"
                size="sm"
                onPress={() => setConfirming('cancel')}
              />
              <Button
                title="Mark complete"
                variant="secondary"
                size="sm"
                onPress={() => setConfirming('complete')}
              />
            </View>
          </View>
        ) : null}

        {/* Runs already filed today. Listed so a finished checklist reads as
            done rather than vanishing, and so the templates below are clearly
            a fresh start rather than a repeat. */}
        {completedToday.length > 0 ? (
          <View style={activeSop ? s.sopListBlock : undefined}>
            <View style={s.cardList}>
              {completedToday.map((run: any) => (
                <View key={run.id} style={[s.card, s.cardDone]}>
                  <View style={s.cardLeft}>
                    <Text style={s.cardTitle}>
                      {run.sop_templates?.name ?? 'SOP'}
                    </Text>
                    <Text style={s.cardDesc}>Complete ✓</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {startableTemplates.length > 0 ? (
          <View style={s.sopListBlock}>
            <Text style={s.sopListLabel}>
              {activeSop ? 'Other SOPs' : 'Start an SOP'}
            </Text>
            {activeSop ? (
              <Text style={s.sopListHint}>
                Finish or cancel the SOP above to start another one.
              </Text>
            ) : null}
            <View style={s.cardList}>
              {startableTemplates.map((tpl: any) => (
                <TouchableOpacity
                  key={tpl.id}
                  style={[s.card, !!activeSop && s.cardDisabled]}
                  onPress={() => handleStartSop(tpl.id)}
                  disabled={!!activeSop || createDailySop.isPending}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${tpl.name}`}
                >
                  <View style={s.cardLeft}>
                    <Text style={s.cardTitle}>{tpl.name}</Text>
                    {tpl.description ? (
                      <Text style={s.cardDesc} numberOfLines={2}>
                        {tpl.description}
                      </Text>
                    ) : null}
                  </View>
                  {activeSop ? null : <Text style={s.chevron}>›</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (todayRuns?.length ?? 0) === 0 ? (
          <Text style={s.sopListHint}>
            Your admin hasn't created any SOPs yet.
          </Text>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={confirming === 'complete'}
        title="Mark SOP complete"
        message={
          sopUnfinished > 0
            ? `${sopUnfinished} of ${sopCheckable.length} tasks are still unchecked. They'll stay unfinished and the checklist will be filed as complete.`
            : 'All tasks are checked. File this checklist as complete?'
        }
        confirmLabel="Mark complete"
        loading={completeDailySop.isPending}
        onConfirm={handleCompleteSop}
        onCancel={() => setConfirming(null)}
      />

      <ConfirmDialog
        visible={confirming === 'cancel'}
        title="Cancel SOP"
        message="This deletes today's run and everything checked off so far. The SOP can be started again from scratch."
        confirmLabel="Cancel SOP"
        cancelLabel="Keep it"
        destructive
        loading={cancelDailySop.isPending}
        onConfirm={handleCancelSop}
        onCancel={() => setConfirming(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
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
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: 0,
    paddingBottom: Spacing.xxl,
  },
  assignedSection: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  cardList: {
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardDone: {
    opacity: 0.7,
  },
  cardLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  sopActiveBlock: {
    gap: Spacing.sm,
  },
  sopActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  sopListBlock: {
    marginTop: Spacing.xl,
  },
  sopListLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  sopListHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  cardDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: Spacing.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  chevron: {
    fontSize: FontSize.xl,
    color: Colors.textMuted,
  },
  sopProgressTrack: {
    height: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  sopProgressFill: {
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
  },
});
