import { supabase } from '@/lib/supabase';
import type { TimeEntry } from '@/types/database';

export async function fetchCurrentClockIn(userId: string): Promise<TimeEntry | null> {
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
}

export async function clockIn(userId: string): Promise<TimeEntry> {
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
}

export async function clockOut(entryId: string): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', entryId)
    .select()
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

export interface TodayStats {
  totalHours: number;
  shiftCount: number;
}

export async function fetchTodayStats(userId: string): Promise<TodayStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabase
    .from('time_entries')
    .select('clock_in, clock_out')
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
}
