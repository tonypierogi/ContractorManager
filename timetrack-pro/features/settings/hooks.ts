import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import type { BusinessSettings } from '@/types/database';
import {
  fetchBusinessSettings,
  fetchOpenAiKey,
  saveOpenAiKey,
  updateBusinessSettings,
} from './api';

export function useBusinessSettings() {
  return useQuery({
    queryKey: qk.settings.business,
    queryFn: fetchBusinessSettings,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateBusinessSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<BusinessSettings>) => updateBusinessSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings.all });
    },
  });
}

export function useOpenAiKey() {
  return useQuery({
    queryKey: qk.settings.openAiKey,
    queryFn: fetchOpenAiKey,
  });
}

export function useSaveOpenAiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveOpenAiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings.all });
    },
  });
}
