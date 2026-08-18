export type UserRole = 'admin' | 'employee';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type TaskAssignmentStatus = 'pending' | 'in_progress' | 'completed';
export type SopItemType = 'task' | 'section';

export interface MediaItem {
  url: string;
  type: string;
  name?: string;
  /**
   * Set when the photo came from a piece of equipment tagged on the task
   * rather than from the camera roll, so untagging the equipment can take its
   * photo back out again. See features/equipment/refs.ts.
   */
  equipment_id?: string;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address_street: string | null;
  address_street2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  role: UserRole;
  hourly_rate: number;
  /** Soft-deactivation: inactive members keep history but are hidden from
   * schedules, timesheets, and assignment pickers. */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessSettings {
  id: string;
  company_name: string;
  company_address: string | null;
  company_email: string | null;
  company_phone: string | null;
  payment_instructions: string | null;
  logo_url: string | null;
  openai_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  description: string | null;
  is_manual: boolean;
  paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  time_entry_id: string;
  date: string;
  description: string | null;
  hours: number;
  rate: number;
  amount: number;
  created_at: string;
}

export interface SopTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SopItem {
  id: string;
  sop_template_id: string;
  sort_order: number;
  item_type: SopItemType;
  title: string;
  description: string | null;
  media: MediaItem[];
  /** Same three shapes as task items carry — run through parseEquipmentRefs(). */
  equipment: StoredEquipmentRef[];
  created_at: string;
  updated_at: string;
}

export interface DailySop {
  id: string;
  date: string;
  sop_template_id: string;
  created_by: string | null;
  completed_at: string | null;
  /** Set once someone shares this day's checklist by link. */
  share_token: string | null;
  created_at: string;
}

export interface SopItemCheck {
  id: string;
  daily_sop_id: string;
  sop_item_id: string;
  checked_by: string;
  checked_at: string;
}

export interface SopTaskComment {
  id: string;
  daily_sop_id: string;
  sop_item_id: string;
  author_id: string;
  comment: string;
  created_at: string;
}

export interface AdHocTask {
  id: string;
  daily_sop_id: string;
  title: string;
  completed_by: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

/**
 * An admin's edits to one floor-plan room, keyed by the zone id from
 * features/locations/zones.ts. Rooms with no row here show their bundled name
 * and photo; a null column means "keep the bundled one" for that field.
 */
export interface LocationZoneOverride {
  zone_id: string;
  label: string | null;
  photo_url: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  name: string;
  location: string | null;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Why a piece of equipment is linked to a task:
 * - 'use': fetch it and put it to work ('from' is where to grab it).
 * - 'return': take it back where it belongs ('to' is where it goes).
 */
export type EquipmentLinkMode = 'use' | 'return';

/**
 * One piece of equipment tagged on a task, with why it's linked and where it
 * travels. `from`/`to` are zone ids (see features/locations/zones.ts); null
 * means "inherit the task's own location_from / location_to".
 */
export interface TaskEquipmentRef {
  id: string;
  mode: EquipmentLinkMode;
  from: string | null;
  to: string | null;
}

/**
 * How a task's equipment tags come back from the database. Rows written before
 * per-equipment zones existed are bare equipment-id strings; newer rows are
 * TaskEquipmentRef objects (and rows written before link modes existed carry
 * no `mode`). Never index into this directly — run it through
 * `parseEquipmentRefs()` (features/equipment/refs.ts), which handles all three.
 */
export type StoredEquipmentRef = string | TaskEquipmentRef;

export interface TaskList {
  id: string;
  title: string;
  description: string | null;
  is_sop: boolean;
  location: string | null;
  share_token: string | null;
  source_video_url: string | null;
  source_transcript: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskListItem {
  id: string;
  task_list_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  item_type: string | null;
  media: MediaItem[];
  location_from: string | null;
  location_to: string | null;
  equipment: StoredEquipmentRef[];
  video_timestamp: number | null;
  created_at: string;
}

export interface TaskListAssignment {
  id: string;
  task_list_id: string;
  assigned_to: string;
  assigned_by: string | null;
  status: TaskAssignmentStatus;
  /** Optional scheduled_shifts row this assignment is pinned to. */
  shift_id: string | null;
  /** The day the assignment is for ('YYYY-MM-DD'); null = no due date. */
  due_date: string | null;
  /** Set when the row was generated from a task_list_recurrences rule. */
  recurrence_id: string | null;
  created_at: string;
}

/** "This list, for this person, every Mon/Wed." Occurrences are materialized
 * into task_list_assignments rows for a rolling window. */
export interface TaskListRecurrence {
  id: string;
  task_list_id: string;
  assigned_to: string;
  /** 0 = Sunday .. 6 = Saturday, matching Date.getDay(). */
  days_of_week: number[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TaskListItemCheck {
  id: string;
  assignment_id: string;
  task_list_item_id: string;
  checked_by: string;
  checked_at: string;
}

/** A check made through a list's public share link. One row per checked item,
 * shared by every viewer of the link (no per-viewer state). */
export interface TaskListAnonymousCheck {
  id: string;
  task_list_id: string;
  task_list_item_id: string;
  checked_at: string;
}
