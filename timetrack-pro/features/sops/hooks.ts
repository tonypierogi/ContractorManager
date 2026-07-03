import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  addAdHocTask,
  addSopComment,
  completeDailySop,
  createDailySop,
  deleteSopTemplate,
  fetchAdHocTasks,
  fetchCompletedDailySops,
  fetchSopChecklist,
  fetchSopTaskComments,
  fetchSopTemplate,
  fetchSopTemplates,
  fetchTodayDailySop,
  saveSopTemplate,
  toggleAdHocTask,
  toggleSopCheck,
  type DailySopWithTemplate,
  type SopChecklistItem,
} from './api';

export type { DailySopWithTemplate, SopChecklistItem };

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

export function useDeleteSopTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSopTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sops.templates });
    },
  });
}

export function useTodayDailySop() {
  return useQuery({
    queryKey: qk.sops.today,
    queryFn: fetchTodayDailySop,
    staleTime: 1000 * 15,
  });
}

export function useCreateDailySop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDailySop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sops.daily });
      queryClient.invalidateQueries({ queryKey: qk.sops.checklists });
    },
  });
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
        (old: DailySopWithTemplate | null | undefined) => {
          if (!old || old.id !== dailySopId) return old;
          return { ...old, completed_at: completedAt };
        },
      );
      queryClient.invalidateQueries({ queryKey: qk.sops.daily });
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
