import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TimeEntry } from '@/types/database';

export interface ShiftFilters {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
}

export function useShifts(userId: string, filters: ShiftFilters = {}) {
  return useQuery({
    queryKey: ['shifts', userId, filters],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .order('clock_in', { ascending: false });

      if (filters.startDate) {
        query = query.gte('clock_in', new Date(filters.startDate).toISOString());
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setDate(end.getDate() + 1);
        query = query.lt('clock_in', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!userId,
  });
}

export function useAllShifts(filters: ShiftFilters = {}) {
  return useQuery({
    queryKey: ['allShifts', filters],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*, profiles(first_name, last_name, hourly_rate)')
        .order('clock_in', { ascending: false });

      if (filters.employeeId) {
        query = query.eq('user_id', filters.employeeId);
      }
      if (filters.startDate) {
        query = query.gte('clock_in', new Date(filters.startDate).toISOString());
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setDate(end.getDate() + 1);
        query = query.lt('clock_in', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useAddShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shift: {
      userId: string;
      clockIn: string;
      clockOut: string;
      description?: string;
    }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: shift.userId,
          clock_in: shift.clockIn,
          clock_out: shift.clockOut,
          description: shift.description || null,
          is_manual: true,
          paid: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['allShifts'] });
      queryClient.invalidateQueries({ queryKey: ['todayStats'] });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<TimeEntry>;
    }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['allShifts'] });
      queryClient.invalidateQueries({ queryKey: ['todayStats'] });
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['allShifts'] });
      queryClient.invalidateQueries({ queryKey: ['todayStats'] });
    },
  });
}

export function useToggleShiftPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update({ paid })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['allShifts'] });
    },
  });
}
