import type { Profile, TimeEntry } from '@/types/database';
import type { ShiftType } from './api';

// 8-color member palette (legacy schedule.js:438). Colors are assigned by the
// member's index in the FULL members list in ALL views (normalizes a legacy
// week-view inconsistency that indexed the filtered list).
export const SCHEDULE_COLORS = [
  '#00d4aa',
  '#6366f1',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#f43f5e',
];

// ---- Date math (weeks start on Sunday; all local-time) ----

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Month range padded to the Sunday on/before the 1st and Saturday on/after the last day. */
export function getMonthPaddedRange(year: number, month: number): {
  start: Date;
  end: Date;
} {
  const start = new Date(year, month, 1);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(year, month + 1, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = weekStart.toLocaleDateString('en-US', opts);
  const endOpts: Intl.DateTimeFormatOptions =
    weekStart.getMonth() === end.getMonth() ? { day: 'numeric' } : opts;
  const endStr = end.toLocaleDateString('en-US', endOpts);
  return `${startStr} – ${endStr}, ${end.getFullYear()}`;
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** Device-local 'YYYY-MM-DD' (never toISOString — avoids UTC day-shift). */
export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateString(s: string): Date {
  return new Date(s + 'T00:00:00');
}

/**
 * True when s is 'YYYY-MM-DD' AND a real calendar date. The round-trip check
 * catches both engine behaviors for impossible dates like '2026-02-30':
 * Invalid Date (Safari/Firefox) and silent rollover to March 2 (Hermes/V8).
 */
export function isValidDateInput(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDateString(s);
  return !isNaN(d.getTime()) && toDateString(d) === s;
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** Inclusive day count between two 'YYYY-MM-DD' strings (legacy schedule.js:798). */
export function countInclusiveDays(startDate: string, endDate: string): number {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

// ---- Time helpers ('HH:MM' wall-clock; tolerate 'HH:MM:SS' from Postgres) ----

export function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

export function isOvernightShift(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return eh * 60 + em < sh * 60 + sm;
}

export function formatScheduleTime(timeStr: string, nextDay?: boolean): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}${nextDay ? ' +1' : ''}`;
}

export function formatEndTime(startTime: string, endTime: string): string {
  return formatScheduleTime(endTime, isOvernightShift(startTime, endTime));
}

export function formatScheduleTimeShort(timeStr: string, nextDay?: boolean): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'p' : 'a';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const base =
    m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
  return nextDay ? base + '+1' : base;
}

export function formatEndTimeShort(startTime: string, endTime: string): string {
  return formatScheduleTimeShort(endTime, isOvernightShift(startTime, endTime));
}

/** Hours between start and end; overnight (end < start) wraps +24h. */
export function calcShiftHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export function getShiftTypeLabel(type: ShiftType): string {
  if (type === 'time_off') return 'Time Off';
  if (type === 'out_of_town') return 'Out of Town';
  return '';
}

// ---- Logged time-entry -> display shift (start-date attribution) ----

export interface LoggedDisplayShift {
  id: string;
  shift_date: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  note: string;
  hours: number;
  paid: boolean;
}

export function timeEntryToDisplayShift(entry: TimeEntry): LoggedDisplayShift {
  const clockIn = new Date(entry.clock_in);
  const clockOut = new Date(entry.clock_out as string);
  const hours = (clockOut.getTime() - clockIn.getTime()) / 3600000;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: entry.id,
    shift_date: toDateString(clockIn),
    employee_id: entry.user_id,
    start_time: `${pad(clockIn.getHours())}:${pad(clockIn.getMinutes())}`,
    end_time: `${pad(clockOut.getHours())}:${pad(clockOut.getMinutes())}`,
    note: entry.description || '',
    hours,
    paid: entry.paid || false,
  };
}

// ---- Member display helpers ----

export function memberDisplayName(m: Profile): string {
  return [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email;
}

/** 'First L' short name used on month pills (legacy schedule.js:433). */
export function memberShortName(m: Profile): string {
  return `${m.first_name || ''} ${(m.last_name || '')[0] || ''}`.trim();
}

export function memberInitials(m: Profile): string {
  return `${(m.first_name || '?')[0]}${(m.last_name || '?')[0]}`.toUpperCase();
}

/**
 * Members sorted by first_name ASC, NULLs last — matches Postgres
 * ORDER BY first_name ASC (legacy loads profiles that way), so row order and
 * palette colors stay stable against the server ordering. Note '' is a real
 * value that sorts first, exactly like Postgres.
 */
export function sortMembers(members: Profile[]): Profile[] {
  return [...members].sort((a, b) => {
    if (a.first_name == null && b.first_name == null) return 0;
    if (a.first_name == null) return 1;
    if (b.first_name == null) return -1;
    return a.first_name.localeCompare(b.first_name);
  });
}
