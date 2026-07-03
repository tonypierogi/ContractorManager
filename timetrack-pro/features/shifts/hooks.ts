import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  addShift,
  deleteShift,
  fetchMyShifts,
  fetchShiftsWithProfiles,
  setShiftPaid,
  type ShiftFilters,
} from './api';

export type { ShiftFilters };

export function useShifts(userId: string, filters: Omit<ShiftFilters, 'userId'> = {}) {
  return useQuery({
    queryKey: qk.timeEntries.mine(userId, filters),
    queryFn: () => fetchMyShifts(userId, filters),
    enabled: !!userId,
  });
}

export function useAllShifts(filters: ShiftFilters = {}) {
  return useQuery({
    queryKey: qk.timeEntries.list(filters),
    queryFn: () => fetchShiftsWithProfiles(filters),
    // keep the previous rows on screen while a new filter refetches
    placeholderData: keepPreviousData,
  });
}

export function useAddShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.timeEntries.all });
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.timeEntries.all });
    },
  });
}

export function useToggleShiftPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, paid }: { id: string; paid: boolean }) => setShiftPaid(id, paid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.timeEntries.all });
    },
  });
}
