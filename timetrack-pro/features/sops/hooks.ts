import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import {
  activeDailySop,
  addAdHocTask,
  addSopComment,
  cancelDailySop,
  completeDailySop,
  createDailySop,
  deleteSopTemplate,
  duplicateSopTemplate,
  ensureDailySopShareToken,
  fetchAdHocTasks,
  fetchCompletedDailySops,
  fetchSopChecklist,
  fetchSopTaskComments,
  fetchSopTemplate,
  fetchSopTemplates,
  fetchTodayDailySops,
  saveSopTemplate,
  toggleAdHocTask,
  toggleSopCheck,
  uploadSopMedia,
  type DailySopWithTemplate,
  type SopChecklistItem,
} from './api';

export type { DailySopWithTemplate, SopChecklistItem };

export function useUploadSopMedia() {
  return useMutation({ mutationFn: uploadSopMedia });
}

/** Generates (or reuses) a day's SOP share token. Errors are handled at the
 * share button, not by the global mutation toast. */
export function useEnsureDailySopShareToken() {
  return useMutation({
    mutationFn: ensureDailySopShareToken,
    meta: { suppressGlobalError: true },
  });
}

export function useSopTemplates() {
  return useQuery({
    queryKey: qk.sops.templates,
    queryFn: fetchSopTemplates,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSopTemplate(id: string) {
  return useQuery({
    queryKey: qk.sops.template(id),
    queryFn: () => fetchSopTemplate(id),
    enabled: !!id,
  });
}

export function useSaveSopTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveSopTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sops.templates });
    },
  });
}

export function useDuplicateSopTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateSopTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sops.templates });
    },
  });
}

export function useDeleteSopTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSopTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sops.templates });
    },
  });
}

/** Every SOP run started today — in-progress and already filed. */
export function useTodayDailySops() {
  return useQuery({
    queryKey: qk.sops.today,
    queryFn: fetchTodayDailySops,
    staleTime: 1000 * 15,
  });
}

/** Just the run in progress. Shares the cache entry with useTodayDailySops. */
export function useTodayDailySop() {
  return useQuery({
    queryKey: qk.sops.today,
    queryFn: fetchTodayDailySops,
    staleTime: 1000 * 15,
    select: activeDailySop,
  });
}

export function useCreateDailySop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDailySop,
    // Both call sites explain the one real failure (a teammate just started a
    // run) themselves; the raw Postgres message helps nobody.
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sops.daily });
      queryClient.invalidateQueries({ queryKey: qk.sops.checklists });
    },
  });
}

/**
 * Live-refresh the roster of SOP runs: a teammate starting today's checklist,
 * marking it done, or cancelling it reaches every other device without a
 * manual refresh. Unfiltered on purpose — a run's row is the thing being
 * created and deleted, so there's no stable id to filter on, and the table
 * sees a handful of writes a day.
 */
export function useDailySopRunsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('sop-runs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_sops' },
        () => {
          queryClient.invalidateQueries({ queryKey: qk.sops.daily });
          queryClient.invalidateQueries({ queryKey: qk.sops.checklists });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Live-refresh today's SOP checklist: checks (and unchecks) from teammates'
 * devices land without a manual refresh. No-op until the tables are added to
 * the realtime publication (share-page migration) — subscribing to a table
 * outside the publication just never fires.
 */
export function useSopChecksRealtime(dailySopId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!dailySopId) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: qk.sops.checklist(dailySopId) });
      queryClient.invalidateQueries({ queryKey: qk.sops.daily });
    };
    const channel = supabase
      .channel(`sop-checks-${dailySopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sop_item_checks',
          filter: `daily_sop_id=eq.${dailySopId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ad_hoc_tasks',
          filter: `daily_sop_id=eq.${dailySopId}`,
        },
        invalidate,
      )
      // Checks coming in from the public share link — someone without an
      // account working the same checklist in a browser.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sop_anonymous_checks',
          filter: `daily_sop_id=eq.${dailySopId}`,
        },
        invalidate,
      )
      // Notes left on a task by whoever is working alongside you.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sop_task_comments',
          filter: `daily_sop_id=eq.${dailySopId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: qk.sops.commentsFor(dailySopId),
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dailySopId, queryClient]);
}

export function useSopChecklist(dailySopId: string, sopTemplateId?: string) {
  return useQuery({
    queryKey: qk.sops.checklist(dailySopId),
    queryFn: () => fetchSopChecklist(dailySopId, sopTemplateId),
    enabled: !!dailySopId,
    staleTime: 1000 * 15,
  });
}

type ChecklistData = Awaited<ReturnType<typeof fetchSopChecklist>>;

export function useToggleSopCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleSopCheck,
    // Optimistic: flip the checkbox in the cache immediately so taps feel
    // instant on slow connections; roll back on error, refetch on settle.
    onMutate: async ({ dailySopId, sopItemId, checked }) => {
      await queryClient.cancelQueries({ queryKey: qk.sops.checklist(dailySopId) });
      const previous = queryClient.getQueryData<ChecklistData>(
        qk.sops.checklist(dailySopId),
      );
      queryClient.setQueryData<ChecklistData>(
        qk.sops.checklist(dailySopId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            templateItems: old.templateItems.map((item) =>
              item.id === sopItemId
                ? { ...item, checked, checked_by_name: null }
                : item,
            ),
          };
        },
      );
      return { previous };
    },
    onError: (_err, { dailySopId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk.sops.checklist(dailySopId), context.previous);
      }
    },
    onSettled: (_data, _err, { dailySopId }) => {
      queryClient.invalidateQueries({ queryKey: qk.sops.checklist(dailySopId) });
      queryClient.invalidateQueries({ queryKey: qk.sops.daily });
    },
  });
}

export function useCompleteDailySop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeDailySop,
    onSuccess: (_data, dailySopId) => {
      const completedAt = new Date().toISOString();
      queryClient.setQueryData(
        qk.sops.today,
        (old: DailySopWithTemplate[] | undefined) =>
          old?.map((run) =>
            run.id === dailySopId ? { ...run, completed_at: completedAt } : run,
          ),
      );
      queryClient.invalidateQueries({ queryKey: qk.sops.daily });
    },
  });
}

/** Cancels today's run. Callers surface the error (it carries the "only the
 * creator can cancel" message), so the global mutation toast stays out of it. */
export function useCancelDailySop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelDailySop,
    meta: { suppressGlobalError: true },
    onSuccess: (_data, dailySopId) => {
      queryClient.setQueryData(
        qk.sops.today,
        (old: DailySopWithTemplate[] | undefined) =>
          old?.filter((run) => run.id !== dailySopId),
      );
      queryClient.invalidateQueries({ queryKey: qk.sops.daily });
      queryClient.invalidateQueries({ queryKey: qk.sops.checklists });
    },
  });
}

export function useCompletedDailySops() {
  return useQuery({
    queryKey: qk.sops.completed,
    queryFn: fetchCompletedDailySops,
  });
}

export function useSopTaskComments(dailySopId: string, itemId?: string) {
  return useQuery({
    queryKey: qk.sops.comments(dailySopId, itemId),
    queryFn: () => fetchSopTaskComments(dailySopId, itemId),
    enabled: !!dailySopId,
  });
}

export function useAddSopComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addSopComment,
    onSuccess: (_data, { dailySopId }) => {
      queryClient.invalidateQueries({ queryKey: qk.sops.commentsFor(dailySopId) });
    },
  });
}

export function useAdHocTasks(dailySopId: string) {
  return useQuery({
    queryKey: qk.sops.adHoc(dailySopId),
    queryFn: () => fetchAdHocTasks(dailySopId),
    enabled: !!dailySopId,
  });
}

export function useAddAdHocTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addAdHocTask,
    onSuccess: (_data, { dailySopId }) => {
      queryClient.invalidateQueries({ queryKey: qk.sops.adHoc(dailySopId) });
      queryClient.invalidateQueries({ queryKey: qk.sops.checklist(dailySopId) });
    },
  });
}

export function useToggleAdHocTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      completedBy,
    }: {
      taskId: string;
      dailySopId: string;
      completedBy: string;
    }) => toggleAdHocTask({ taskId, completedBy }),
    onSuccess: (_data, { dailySopId }) => {
      queryClient.invalidateQueries({ queryKey: qk.sops.checklist(dailySopId) });
      queryClient.invalidateQueries({ queryKey: qk.sops.adHoc(dailySopId) });
    },
  });
}
