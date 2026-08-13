export type UserRole = 'admin' | 'employee';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type TaskAssignmentStatus = 'pending' | 'in_progress' | 'completed';
export type SopItemType = 'task' | 'section';

export interface MediaItem {
  url: string;
  type: string;
  name?: string;
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
  equipment: string[];
  created_at: string;
  updated_at: string;
}

export interface DailySop {
  id: string;
  date: string;
  sop_template_id: string;
  created_by: string | null;
  completed_at: string | null;
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

export interface Equipment {
  id: string;
  name: string;
  location: string | null;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

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
  equipment: string[];
  video_timestamp: number | null;
  created_at: string;
}

export interface TaskListAssignment {
  id: string;
  task_list_id: string;
  assigned_to: string;
  assigned_by: string | null;
  status: TaskAssignmentStatus;
  created_at: string;
}

export interface TaskListItemCheck {
  id: string;
  assignment_id: string;
  task_list_item_id: string;
  checked_by: string;
  checked_at: string;
}
