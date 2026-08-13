import { supabase } from '@/lib/supabase';
import type { Profile, TimeEntry } from '@/types/database';

export interface ShiftFilters {
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export type TimeEntryWithProfile = TimeEntry & {
  profiles: Pick<Profile, 'first_name' | 'last_name' | 'hourly_rate'> | null;
};

async function runShiftQuery(select: string, filters: ShiftFilters) {
  let query = supabase
    .from('time_entries')
    .select(select)
    .order('clock_in', { ascending: false });

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
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
}

export async function fetchMyShifts(
  userId: string,
  filters: Omit<ShiftFilters, 'userId'> = {},
): Promise<TimeEntry[]> {
  const data = await runShiftQuery('*', { ...filters, userId });
  return data as unknown as TimeEntry[];
}

export async function fetchShiftsWithProfiles(
  filters: ShiftFilters = {},
): Promise<TimeEntryWithProfile[]> {
  const data = await runShiftQuery(
    '*, profiles(first_name, last_name, hourly_rate)',
    filters,
  );
  return data as unknown as TimeEntryWithProfile[];
}

export async function addShift(shift: {
  userId: string;
  clockIn: string;
  clockOut: string;
  description?: string;
}): Promise<TimeEntry> {
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
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from('time_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function setShiftPaid(id: string, paid: boolean): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .update({ paid })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as TimeEntry;
}
