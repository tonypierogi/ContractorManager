import { useCallback, useMemo, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  createScheduledShifts,
  deleteScheduledShift,
  fetchMyScheduledShifts,
  fetchScheduledShifts,
  fetchScheduleTimeEntries,
  updateScheduledShift,
  type NewScheduledShift,
  type ScheduledShiftPatch,
  type ScheduleEntryFilters,
  type ScheduleShiftFilters,
} from './api';
import {
  formatMonthLabel,
  formatWeekLabel,
  getMonthPaddedRange,
  getWeekEnd,
  getWeekStart,
} from './lib';

// ---- Queries ----

export function useScheduledShifts(filters: ScheduleShiftFilters) {
  return useQuery({
    queryKey: qk.schedule.shifts(filters),
    queryFn: () => fetchScheduledShifts(filters),
    placeholderData: keepPreviousData,
  });
}

export function useMySchedule(
  userId: string | undefined,
  filters: Omit<ScheduleShiftFilters, 'employeeId'>,
) {
  return useQuery({
    queryKey: qk.schedule.mine(userId, filters),
    queryFn: () => fetchMyScheduledShifts(userId as string, filters),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

/** Completed time entries overlaid on the admin schedule (read-only). */
export function useScheduleTimeEntries(filters: ScheduleEntryFilters) {
  return useQuery({
    queryKey: qk.timeEntries.list({ scope: 'schedule', ...filters }),
    queryFn: () => fetchScheduleTimeEntries(filters),
    placeholderData: keepPreviousData,
  });
}

// ---- Mutations (all invalidate the schedule domain) ----

// These three run from inside the ShiftFormModal, where the global error
// toast renders BEHIND the native RN Modal — the modal shows errors inline
// instead, so the global handler is suppressed.
export function useCreateShifts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: NewScheduledShift[]) => createScheduledShifts(rows),
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.schedule.all });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ScheduledShiftPatch }) =>
      updateScheduledShift(id, patch),
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.schedule.all });
    },
  });
}

export function useDeleteScheduledShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScheduledShift(id),
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.schedule.all });
    },
  });
}

// ---- Visible-range state (week/month navigation with legacy carry-over rules) ----

export type ScheduleViewMode = 'week' | 'month';

interface RangeState {
  viewMode: ScheduleViewMode;
  weekStartMs: number; // epoch ms of the week's Sunday (local midnight)
  month: number;
  year: number;
}

export function useScheduleRange() {
  const [state, setState] = useState<RangeState>(() => {
    const now = new Date();
    return {
      viewMode: 'week',
      weekStartMs: getWeekStart(now).getTime(),
      month: now.getMonth(),
      year: now.getFullYear(),
    };
  });

  const goPrev = useCallback(() => {
    setState((s) =>
      s.viewMode === 'week'
        ? { ...s, weekStartMs: shiftWeek(s.weekStartMs, -7) }
        : s.month === 0
          ? { ...s, month: 11, year: s.year - 1 }
          : { ...s, month: s.month - 1 },
    );
  }, []);

  const goNext = useCallback(() => {
    setState((s) =>
      s.viewMode === 'week'
        ? { ...s, weekStartMs: shiftWeek(s.weekStartMs, 7) }
        : s.month === 11
          ? { ...s, month: 0, year: s.year + 1 }
          : { ...s, month: s.month + 1 },
    );
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setState((s) => ({
      ...s,
      weekStartMs: getWeekStart(now).getTime(),
      month: now.getMonth(),
      year: now.getFullYear(),
    }));
  }, []);

  const setViewMode = useCallback((mode: ScheduleViewMode) => {
    setState((s) => {
      if (mode === s.viewMode) return s;
      if (mode === 'month') {
        const ws = new Date(s.weekStartMs);
        return { ...s, viewMode: 'month', month: ws.getMonth(), year: ws.getFullYear() };
      }
      const now = new Date();
      const weekStart =
        s.year === now.getFullYear() && s.month === now.getMonth()
          ? getWeekStart(now)
          : getWeekStart(new Date(s.year, s.month, 1));
      return { ...s, viewMode: 'week', weekStartMs: weekStart.getTime() };
    });
  }, []);

  /** Post-save behavior: jump to the month view containing a given date. */
  const jumpToMonth = useCallback((month: number, year: number) => {
    setState((s) => ({ ...s, viewMode: 'month', month, year }));
  }, []);

  return useMemo(() => {
    const weekStart = new Date(state.weekStartMs);
    const { start, end } =
      state.viewMode === 'week'
        ? { start: weekStart, end: getWeekEnd(weekStart) }
        : getMonthPaddedRange(state.year, state.month);
    const label =
      state.viewMode === 'week'
        ? formatWeekLabel(weekStart)
        : formatMonthLabel(state.year, state.month);
    return {
      viewMode: state.viewMode,
      weekStart,
      month: state.month,
      year: state.year,
      start,
      end,
      label,
      goPrev,
      goNext,
      goToday,
      setViewMode,
      jumpToMonth,
    };
  }, [state, goPrev, goNext, goToday, setViewMode, jumpToMonth]);
}

function shiftWeek(weekStartMs: number, days: number): number {
  const d = new Date(weekStartMs);
  d.setDate(d.getDate() + days);
  return d.getTime();
}
