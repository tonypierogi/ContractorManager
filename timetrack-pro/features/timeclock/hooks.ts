import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { clockIn, clockOut, fetchCurrentClockIn, fetchTodayStats } from './api';

export function useCurrentClockIn(userId: string) {
  return useQuery({
    queryKey: qk.timeEntries.current(userId),
    queryFn: () => fetchCurrentClockIn(userId),
    enabled: !!userId,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clockIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.timeEntries.all });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId }: { entryId: string; userId: string }) => clockOut(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.timeEntries.all });
    },
  });
}

export function useTodayStats(userId: string) {
  return useQuery({
    queryKey: qk.timeEntries.todayStats(userId),
    queryFn: () => fetchTodayStats(userId),
    enabled: !!userId,
  });
}
