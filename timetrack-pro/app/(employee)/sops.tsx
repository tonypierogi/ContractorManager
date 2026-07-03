import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SopCheckItem from '@/components/sops/SopCheckItem';
import { useAuth } from '@/lib/auth-provider';
import {
  useTodayDailySop,
  useSopChecklist,
  useToggleSopCheck,
  useCompleteDailySop,
  useCompletedDailySops,
  useSopTemplates,
  useCreateDailySop,
} from '@/hooks/useSops';
import { useToast } from '@/components/ui/Toast';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatDate } from '@/utils/format';

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SopsScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: todaySop, isLoading: loadingTodaySop, refetch: refetchTodaySop } = useTodayDailySop();
  const { data: checklist, isLoading: loadingChecklist, refetch: refetchChecklist } = useSopChecklist(todaySop?.id ?? '');
  const { data: completedSops } = useCompletedDailySops();
  const { data: templates, isLoading: loadingTemplates } = useSopTemplates();
  const toggleCheck = useToggleSopCheck();
  const completeDailySop = useCompleteDailySop();
  const createDailySop = useCreateDailySop();

  const handleToggle = (itemId: string) => {
    if (!todaySop || !user) return;
    const item = checklist?.templateItems.find((i) => i.id === itemId);
    toggleCheck.mutate({
      dailySopId: todaySop.id,
      sopItemId: itemId,
      checkedBy: user.id,
      checked: !item?.checked,
    });
  };

  const handleRefresh = () => {
    refetchTodaySop();
    refetchChecklist();
  };

  const handleStartChecklist = (templateId: string) => {
    if (!user) return;
    createDailySop.mutate({ sopTemplateId: templateId, createdBy: user.id });
  };

  const totalItems = checklist?.templateItems.filter((i) => i.item_type !== 'section').length ?? 0;
  const checkedItems = checklist?.templateItems.filter((i) => i.item_type !== 'section' && i.checked).length ?? 0;
  const percentage = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  const allChecked = totalItems > 0 && checkedItems === totalItems;
  const isComplete = !!todaySop?.completed_at || completeDailySop.isSuccess;

  const handleMarkDone = () => {
    if (!todaySop) return;
    completeDailySop.mutate(todaySop.id, {
      onSuccess: () => showToast('SOP marked as complete!'),
      onError: () => showToast('Failed to mark SOP as done. Please try again.', 'error'),
    });
  };

  const renderActiveChecklist = () => (
    <View style={s.panel}>
      <View style={s.panelHeaderRow}>
        <Text style={s.panelTitle} numberOfLines={1}>
          {todaySop?.sop_templates?.name ?? 'Daily SOP'}
        </Text>
        <TouchableOpacity onPress={handleRefresh} style={s.ghostBtn}>
          <Text style={s.ghostBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.panelHint}>
        Shared with the team — everyone can check off items.
      </Text>

      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${percentage}%` }]} />
      </View>
      <Text style={s.progressText}>
        {checkedItems} of {totalItems} tasks complete ({percentage}%)
      </Text>

      <View style={s.checklistItems}>
        {checklist?.templateItems.map((item) => (
          <SopCheckItem
            key={item.id}
            item={item}
            onToggle={() => handleToggle(item.id)}
          />
        ))}
      </View>

      {allChecked && (
        <TouchableOpacity
          style={s.markDoneBtn}
          onPress={handleMarkDone}
          activeOpacity={0.7}
          disabled={completeDailySop.isPending}
        >
          <Text style={s.markDoneBtnText}>
            {completeDailySop.isPending ? 'Submitting...' : 'Mark SOP as Done'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTodayComplete = () => (
    <View style={s.centeredState}>
      <Text style={s.stateIcon}>✓</Text>
      <Text style={s.stateTitle}>Today's checklist is complete</Text>
      <Text style={s.stateDesc}>All tasks have been finished.</Text>
    </View>
  );

  const renderPickTemplate = () => (
    <View>
      <Text style={s.pickTitle}>Start a new checklist</Text>
      <Text style={s.pickHint}>Choose an SOP below to start today's checklist.</Text>
      <View style={s.templateList}>
        {templates?.map((tpl) => (
          <TouchableOpacity
            key={tpl.id}
            style={s.templateBtn}
            onPress={() => handleStartChecklist(tpl.id)}
            activeOpacity={0.7}
          >
            <View style={s.templateRow}>
              <Text style={s.templateIcon}>✓</Text>
              <Text style={s.templateName}>{tpl.name}</Text>
            </View>
            {tpl.description ? (
              <Text style={s.templateDesc}>{tpl.description}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderNoTemplates = () => (
    <View style={s.centeredState}>
      <Text style={s.stateIcon}>📋</Text>
      <Text style={s.stateTitle}>No SOPs Available</Text>
      <Text style={s.stateDesc}>
        Your admin hasn't created any standard operating procedures yet.
      </Text>
    </View>
  );

  const renderMainContent = () => {
    if (loadingTodaySop || (todaySop && loadingChecklist) || (!todaySop && loadingTemplates)) {
      return (
        <View style={s.centeredState}>
          <Text style={s.stateDesc}>Loading...</Text>
        </View>
      );
    }
    if (todaySop && isComplete) {
      return renderTodayComplete();
    }
    if (todaySop && checklist) {
      return renderActiveChecklist();
    }
    if (templates && templates.length > 0) {
      return renderPickTemplate();
    }
    return renderNoTemplates();
  };

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        <Text style={s.heading}>SOPs</Text>
        <Text style={s.subtitle}>{formatFullDate(new Date())}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {renderMainContent()}

        {(completedSops?.length ?? 0) > 0 && (
          <View style={s.completedSection}>
            <Text style={s.sectionTitle}>Completed SOPs</Text>
            {completedSops!.map((sop: any) => (
              <View key={sop.id} style={s.completedCard}>
                <Text style={s.completedName}>
                  {sop.sop_templates?.name ?? 'SOP'}
                </Text>
                <Text style={s.completedDate}>{formatDate(sop.date)}</Text>
                <Text style={s.completedLabel}>
                  Completed {formatDate(sop.completed_at)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  },

  // Active checklist panel
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  ghostBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  ghostBtnText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: '500',
  },
  panelHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    marginVertical: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
  },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  checklistItems: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  markDoneBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  markDoneBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '600',
  },

  // Centered states (complete / no templates)
  centeredState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  stateIcon: {
    fontSize: 48,
    color: Colors.accent,
    marginBottom: Spacing.md,
  },
  stateTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  stateDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },

  // Pick template
  pickTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  pickHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  templateList: {
    gap: Spacing.sm,
  },
  templateBtn: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  templateIcon: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: '700',
  },
  templateName: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  templateDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginLeft: Spacing.lg + Spacing.xs,
  },

  // Completed SOPs section
  completedSection: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  completedCard: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  completedName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  completedDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  completedLabel: {
    fontSize: FontSize.xs,
    color: Colors.success,
    marginTop: Spacing.xs,
  },
});
