import { supabase } from '@/lib/supabase';

/** Raw row shape returned by the linked task-lists select. */
interface LinkedTaskListRow {
  id: string;
  title: string;
  is_sop: boolean | null;
  task_list_items: { id: string }[] | null;
  task_list_assignments: { id: string; status: string | null }[] | null;
}

export interface LinkedTaskList {
  id: string;
  title: string;
  isSop: boolean;
  itemCount: number;
  assignedCount: number;
}

/**
 * Task lists / SOPs linked to a floor-plan zone
 * (task_lists.location stores the zone id verbatim).
 * Legacy: old/js/locations.js loadLinkedTasks.
 */
export async function fetchLinkedTaskLists(
  zoneId: string,
): Promise<LinkedTaskList[]> {
  const { data, error } = await supabase
    .from('task_lists')
    .select('id, title, is_sop, task_list_items(id), task_list_assignments(id, status)')
    .eq('location', zoneId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as LinkedTaskListRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    isSop: !!row.is_sop,
    itemCount: (row.task_list_items ?? []).length,
    assignedCount: (row.task_list_assignments ?? []).length,
  }));
}
