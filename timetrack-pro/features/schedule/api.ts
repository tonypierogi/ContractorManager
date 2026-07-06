import { supabase } from '@/lib/supabase';
import type { TimeEntry } from '@/types/database';

// ---- Row types (scheduled_shifts documented in
// supabase/migrations/20260703000000_scheduled_shifts.sql) ----

export type ShiftType = 'shift' | 'time_off' | 'out_of_town';

export interface ScheduledShift {
  id: string;
  employee_id: string;
  shift_date: string; // 'YYYY-MM-DD' (device-local)
  start_time: string; // 'HH:MM' written; Postgres time may return 'HH:MM:SS'
  end_time: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NewScheduledShift {
  employee_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
  created_by: string;
}

export interface ScheduledShiftPatch {
  employee_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
}

// ---- Note-prefix type encoding (MUST stay byte-compatible with prod rows;
// legacy old/js/schedule.js:13-25) ----

const SHIFT_TYPE_PREFIXES: Partial<Record<ShiftType, string>> = {
  time_off: '[OFF]',
  out_of_town: '[OOT]',
};

/** Decode a stored note into its shift type + display text. */
export function parseShiftType(rawNote: string | null | undefined): {
  type: ShiftType;
  note: string;
} {
  if (!rawNote) return { type: 'shift', note: '' };
  if (rawNote.startsWith('[OFF]')) {
    return { type: 'time_off', note: rawNote.slice(5).trim() };
  }
  if (rawNote.startsWith('[OOT]')) {
    return { type: 'out_of_town', note: rawNote.slice(5).trim() };
  }
  return { type: 'shift', note: rawNote };
}

/** Encode a shift type + free text into the stored note value. */
export function buildNote(
  type: ShiftType,
  text: string | null | undefined,
): string | null {
  const prefix = SHIFT_TYPE_PREFIXES[type];
  if (prefix) return `${prefix} ${text || ''}`.trim();
  return text || null;
}

// ---- CRUD ----

export interface ScheduleShiftFilters {
  startDate: string; // inclusive 'YYYY-MM-DD'
  endDate: string; // inclusive 'YYYY-MM-DD'
  employeeId?: string;
}

export async function fetchScheduledShifts(
  filters: ScheduleShiftFilters,
): Promise<ScheduledShift[]> {
  let query = supabase
    .from('scheduled_shifts')
    .select('*')
    .gte('shift_date', filters.startDate)
    .lte('shift_date', filters.endDate)
    .order('start_time');

  if (filters.employeeId) {
    query = query.eq('employee_id', filters.employeeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ScheduledShift[];
}

export async function fetchMyScheduledShifts(
  userId: string,
  filters: Omit<ScheduleShiftFilters, 'employeeId'>,
): Promise<ScheduledShift[]> {
  const { data, error } = await supabase
    .from('scheduled_shifts')
    .select('*')
    .eq('employee_id', userId)
    .gte('shift_date', filters.startDate)
    .lte('shift_date', filters.endDate)
    .order('shift_date')
    .order('start_time');
  if (error) throw error;
  return (data ?? []) as ScheduledShift[];
}

export async function createScheduledShifts(
  rows: NewScheduledShift[],
): Promise<void> {
  const { error } = await supabase.from('scheduled_shifts').insert(rows);
  if (error) throw error;
}

export async function updateScheduledShift(
  id: string,
  patch: ScheduledShiftPatch,
): Promise<void> {
  const { error } = await supabase
    .from('scheduled_shifts')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteScheduledShift(id: string): Promise<void> {
  const { error } = await supabase.from('scheduled_shifts').delete().eq('id', id);
  if (error) throw error;
}

// ---- Logged time entries for the visible range (read-only overlay /
// pay-summary comparison; start-date attribution — legacy schedule.js:243-261) ----

export interface ScheduleEntryFilters {
  startISO: string;
  endISO: string;
  employeeId?: string;
}

export async function fetchScheduleTimeEntries(
  filters: ScheduleEntryFilters,
): Promise<TimeEntry[]> {
  let query = supabase
    .from('time_entries')
    .select('*')
    .gte('clock_in', filters.startISO)
    .lte('clock_in', filters.endISO)
    .not('clock_out', 'is', null);

  if (filters.employeeId) {
    query = query.eq('user_id', filters.employeeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

// ---- Row builders (per-day time-off expansion, weekly repeat) ----

/** One all-day row per calendar day of the inclusive range (legacy schedule.js:844-856). */
export function buildTimeOffRows(input: {
  employeeId: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD' inclusive
  type: ShiftType;
  reason: string;
  createdBy: string;
}): NewScheduledShift[] {
  const note = buildNote(input.type, input.reason);
  const rows: NewScheduledShift[] = [];
  const end = new Date(input.endDate + 'T00:00:00');
  const d = new Date(input.startDate + 'T00:00:00');
  while (d <= end) {
    rows.push({
      employee_id: input.employeeId,
      shift_date: toDateString(d),
      start_time: '00:00',
      end_time: '23:59',
      note,
      created_by: input.createdBy,
    });
    d.setDate(d.getDate() + 1);
  }
  return rows;
}

/** N rows at +7-day intervals sharing times/note (legacy schedule.js:949-964). */
export function buildRepeatRows(input: {
  employeeId: string;
  startDate: string;
  startTime: string;
  endTime: string;
  note: string | null;
  weeks: number;
  createdBy: string;
}): NewScheduledShift[] {
  const base = new Date(input.startDate + 'T00:00:00');
  const rows: NewScheduledShift[] = [];
  for (let w = 0; w < input.weeks; w++) {
    const d = new Date(base);
    d.setDate(d.getDate() + w * 7);
    rows.push({
      employee_id: input.employeeId,
      shift_date: toDateString(d),
      start_time: input.startTime,
      end_time: input.endTime,
      note: input.note,
      created_by: input.createdBy,
    });
  }
  return rows;
}

// Local re-implementation to avoid a circular import with lib.ts.
function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
