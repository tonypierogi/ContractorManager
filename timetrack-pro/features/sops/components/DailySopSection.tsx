import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import SopCheckItem from '@/features/sops/components/SopCheckItem';
import { useAuth } from '@/features/auth/auth-provider';
import {
  useTodayDailySop,
  useSopChecklist,
  useSopChecksRealtime,
  useToggleSopCheck,
  useCompleteDailySop,
  useCompletedDailySops,
  useSopTemplates,
  useCreateDailySop,
  useAddAdHocTask,
  useToggleAdHocTask,
} from '@/features/sops/hooks';
import { useEquipment } from '@/features/equipment/hooks';
import { useToast } from '@/components/ui/Toast';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatDate } from '@/utils/format';

/**
 * Today's shared SOP checklist, extracted from the old standalone SOPs screen
 * so the unified My Work page can render it beneath assigned task lists.
 * Owns its own data fetching; the host screen supplies the scroll container.
 */
export default function DailySopSection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const {
    data: todaySop,
    isLoading: loadingTodaySop,
    refetch: refetchTodaySop,
  } = useTodayDailySop();
  const {
    data: checklist,
    isLoading: loadingChecklist,
    refetch: refetchChecklist,
  } = useSopChecklist(todaySop?.id ?? '', todaySop?.sop_template_id);
  const { data: completedSops } = useCompletedDailySops();
  const { data: templates, isLoading: loadingTemplates } = useSopTemplates();
  const toggleCheck = useToggleSopCheck();
  const completeDailySop = useCompleteDailySop();
  const createDailySop = useCreateDailySop();
  const addAdHocTask = useAddAdHocTask();
  const toggleAdHocTask = useToggleAdHocTask();
  const { data: equipment } = useEquipment();
  const [newAdHocTitle, setNewAdHocTitle] = useState('');

  const equipmentNames = useMemo(
    () => new Map((equipment ?? []).map((e: any) => [e.id, e.name] as const)),
    [equipment],
  );

  const dailySopId = todaySop?.id;
  // Teammates share this checklist — stream their checks in live.
  useSopChecksRealtime(dailySopId);
  const userId = user?.id;
  const handleToggle = useCallback(
    (itemId: string, checked: boolean) => {
      if (!dailySopId || !userId) return;
      toggleCheck.mutate({
        dailySopId,
        sopItemId: itemId,
        checkedBy: userId,
        checked,
      });
    },
    [dailySopId, userId, toggleCheck.mutate],
  );

  const handleRefresh = () => {
    refetchTodaySop();
    refetchChecklist();
  };

  const handleStartChecklist = (templateId: string) => {
    if (!user) return;
    createDailySop.mutate({ sopTemplateId: templateId, createdBy: user.id });
  };

  const handleAddAdHoc = () => {
    const title = newAdHocTitle.trim();
    if (!title || !dailySopId || !userId) return;
    addAdHocTask.mutate(
      { dailySopId, title, createdBy: userId },
      {
        onSuccess: () => setNewAdHocTitle(''),
        onError: () => showToast('Failed to add task. Please try again.', 'error'),
      },
    );
  };

  const handleToggleAdHoc = (taskId: string) => {
    if (!dailySopId || !userId) return;
    toggleAdHocTask.mutate({ taskId, dailySopId, completedBy: userId });
  };

  const totalItems =
    checklist?.templateItems.filter((i) => i.item_type !== 'section').length ?? 0;
  const checkedItems =
    checklist?.templateItems.filter(
      (i) => i.item_type !== 'section' && i.checked,
    ).length ?? 0;
  const percentage = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  const allChecked = totalItems > 0 && checkedItems === totalItems;
  const isComplete = !!todaySop?.completed_at || completeDailySop.isSuccess;

  const handleMarkDone = () => {
    if (!todaySop) return;
    completeDailySop.mutate(todaySop.id, {
      onSuccess: () => showToast('SOP marked as complete!'),
      onError: () =>
        showToast('Failed to mark SOP as done. Please try again.', 'error'),
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
            onToggle={handleToggle}
            equipmentNames={equipmentNames}
          />
        ))}
      </View>

      {(checklist?.adHocItems.length ?? 0) > 0 && (
        <View style={s.adHocSection}>
          <Text style={s.adHocTitle}>Added today</Text>
          {checklist!.adHocItems.map((task) => {
            const done = !!task.completed_at;
            return (
              <TouchableOpacity
                key={task.id}
                style={s.adHocRow}
                onPress={() => handleToggleAdHoc(task.id)}
                activeOpacity={0.7}
              >
                <View style={[s.adHocBox, done && s.adHocBoxChecked]}>
                  {done && <Text style={s.adHocCheckmark}>✓</Text>}
                </View>
                <Text style={[s.adHocText, done && s.adHocTextChecked]}>
                  {task.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={s.addRow}>
        <TextInput
          style={s.addInput}
          value={newAdHocTitle}
          onChangeText={setNewAdHocTitle}
          placeholder="Add a task for today..."
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={handleAddAdHoc}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[s.addBtn, !newAdHocTitle.trim() && s.addBtnDisabled]}
          onPress={handleAddAdHoc}
          disabled={!newAdHocTitle.trim() || addAdHocTask.isPending}
          activeOpacity={0.7}
        >
          <Text style={s.addBtnText}>{addAdHocTask.isPending ? '...' : 'Add'}</Text>
        </TouchableOpacity>
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
    if (
      loadingTodaySop ||
      (todaySop && loadingChecklist) ||
      (!todaySop && loadingTemplates)
    ) {
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
    <View>
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
    </View>
  );
}

const s = StyleSheet.create({
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
  adHocSection: {
    marginTop: Spacing.lg,
  },
  adHocTitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  adHocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  adHocBox: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adHocBoxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  adHocCheckmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  adHocText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  adHocTextChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  addBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '600',
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
