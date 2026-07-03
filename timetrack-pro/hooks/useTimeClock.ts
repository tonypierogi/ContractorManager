import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TimeEntry } from '@/types/database';

export function useCurrentClockIn(userId: string) {
  return useQuery({
    queryKey: ['currentClockIn', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TimeEntry | null;
    },
    enabled: !!userId,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: userId,
          clock_in: new Date().toISOString(),
          is_manual: false,
          paid: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['currentClockIn', userId] });
      queryClient.invalidateQueries({ queryKey: ['todayStats', userId] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      userId,
    }: {
      entryId: string;
      userId: string;
    }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', entryId)
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['currentClockIn', userId] });
      queryClient.invalidateQueries({ queryKey: ['todayStats', userId] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

export function useTodayStats(userId: string) {
  return useQuery({
    queryKey: ['todayStats', userId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('clock_in', today.toISOString())
        .lt('clock_in', tomorrow.toISOString());
      if (error) throw error;

      let totalHours = 0;
      (data ?? []).forEach((entry) => {
        if (entry.clock_out) {
          const start = new Date(entry.clock_in).getTime();
          const end = new Date(entry.clock_out).getTime();
          totalHours += (end - start) / 3_600_000;
        }
      });

      return {
        totalHours,
        shiftCount: (data ?? []).length,
      };
    },
    enabled: !!userId,
  });
}
