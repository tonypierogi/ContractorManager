import { supabase } from '@/lib/supabase';
import { uploadImageToMediaBucket, type UploadImageInput } from '@/lib/uploads';
import type { LocationZoneOverride } from '@/types/database';

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

export interface SaveZoneOverrideInput {
  zoneId: string;
  /** null clears the rename and falls back to the bundled name. */
  label: string | null;
  /** null clears the upload and falls back to the bundled photo. */
  photoUrl: string | null;
}

/**
 * Admin edits to floor-plan rooms. Missing rooms simply have no row, so a
 * fresh database returns [] and every room keeps its bundled name and photo.
 */
export async function fetchZoneOverrides(): Promise<LocationZoneOverride[]> {
  const { data, error } = await supabase.from('location_zone_overrides').select('*');
  if (error) throw error;
  return (data ?? []) as LocationZoneOverride[];
}

export async function saveZoneOverride(
  input: SaveZoneOverrideInput,
): Promise<LocationZoneOverride> {
  const { data, error } = await supabase
    .from('location_zone_overrides')
    .upsert(
      {
        zone_id: input.zoneId,
        label: input.label,
        photo_url: input.photoUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'zone_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as LocationZoneOverride;
}

/** Room photos live beside the other media uploads, under a `locations/` prefix. */
export function uploadZonePhoto(params: UploadImageInput): Promise<string> {
  return uploadImageToMediaBucket('locations', params);
}
