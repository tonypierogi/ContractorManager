import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  deleteInventoryItem,
  fetchInventoryItems,
  fetchInventoryRuns,
  fetchLastInventoryRun,
  fetchLatestItemChecks,
  fetchRunChecks,
  saveInventoryItem,
  submitInventoryRun,
  uploadInventoryCheckPhoto,
  uploadInventoryImage,
} from './api';

export function useInventoryItems(activeOnly = false) {
  return useQuery({
    queryKey: activeOnly ? qk.inventory.activeItems : qk.inventory.items,
    queryFn: () => fetchInventoryItems(activeOnly),
  });
}

export function useSaveInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.inventory.all });
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.inventory.all });
    },
  });
}

export function useLastInventoryRun() {
  return useQuery({
    queryKey: qk.inventory.lastRun,
    queryFn: fetchLastInventoryRun,
  });
}

export function useInventoryRuns() {
  return useQuery({
    queryKey: qk.inventory.runs,
    queryFn: () => fetchInventoryRuns(),
  });
}

export function useRunChecks(runId: string | null) {
  return useQuery({
    queryKey: qk.inventory.runChecks(runId ?? 'none'),
    queryFn: () => fetchRunChecks(runId!),
    enabled: !!runId,
  });
}

export function useLatestItemChecks() {
  return useQuery({
    queryKey: qk.inventory.latestChecks,
    queryFn: fetchLatestItemChecks,
  });
}

export function useSubmitInventoryRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitInventoryRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.inventory.all });
    },
  });
}

export function useUploadInventoryImage() {
  return useMutation({ mutationFn: uploadInventoryImage });
}

export function useUploadCheckPhoto() {
  return useMutation({ mutationFn: uploadInventoryCheckPhoto });
}
