import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

const INVENTORY_STORAGE_BUCKET = 'sop-media';

// ==================== ROW TYPES ====================
// Defined here (not in types/database.ts) — shared file has parallel work in flight.

export type InventoryStatus = 'Plenty' | 'Some' | 'OUT';

export interface InventoryItem {
  id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  /** Zone id from LOCATION_ZONES (e.g. 'office'), null = no location. */
  location: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

export interface InventoryRun {
  id: string;
  user_id: string | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface InventoryCheck {
  id: string;
  run_id: string;
  item_id: string | null;
  status: InventoryStatus;
  notes: string | null;
  photo_url: string | null;
  checked_at: string;
}

export interface InventoryCheckWithItem extends InventoryCheck {
  inventory_items: Pick<InventoryItem, 'name' | 'location' | 'image_url'> | null;
}

export interface LastInventoryRun {
  run: InventoryRun;
  runnerName: string;
  checks: InventoryCheckWithItem[];
}

// ==================== ITEMS ====================

export async function fetchInventoryItems(activeOnly = false): Promise<InventoryItem[]> {
  let query = supabase
    .from('inventory_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name');
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as InventoryItem[];
}

export type SaveInventoryItemInput = {
  id?: string;
  name: string;
  description: string | null;
  location: string | null;
  image_url: string | null;
  is_active: boolean;
  /** Required on insert; ignored on update (legacy parity). */
  created_by?: string;
};

export async function saveInventoryItem(input: SaveInventoryItemInput): Promise<void> {
  const { id, created_by, ...row } = input;
  if (id) {
    const { error } = await supabase
      .from('inventory_items')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('inventory_items')
      .insert({ ...row, created_by });
    if (error) throw error;
  }
}

/** Hard delete (legacy parity) — the DB cascades away inventory_checks rows for the item. */
export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) throw error;
}

// ==================== STORAGE UPLOADS ====================

const MAX_IMAGE_DIM = 1920;

/**
 * Legacy compressImage parity (utils.js:78-108): fit within 1920x1920,
 * re-encode JPEG q0.8, never upscale. Falls back to the original file when
 * the picker didn't report dimensions or the image already fits.
 */
async function downscaleForUpload(
  uri: string,
  width?: number,
  height?: number,
): Promise<string> {
  if (!width || !height) return uri;
  const ratio = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height, 1);
  if (ratio >= 1) return uri;
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.round(width * ratio) } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export interface UploadImageInput {
  userId: string;
  uri: string;
  width?: number;
  height?: number;
}

async function uploadImageToBucket(
  subdir: 'inventory' | 'inventory-checks',
  { userId, uri, width, height }: UploadImageInput,
): Promise<string> {
  const finalUri = await downscaleForUpload(uri, width, height);
  const rawName = finalUri.split('/').pop() || 'photo.jpg';
  // Legacy filename sanitization (inventory.js:140)
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${subdir}/${Date.now()}-${safeName}`;
  const res = await fetch(finalUri);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage
    .from(INVENTORY_STORAGE_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(INVENTORY_STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function uploadInventoryImage(params: UploadImageInput): Promise<string> {
  return uploadImageToBucket('inventory', params);
}

export function uploadInventoryCheckPhoto(params: UploadImageInput): Promise<string> {
  return uploadImageToBucket('inventory-checks', params);
}

// ==================== RUNS ====================

export async function fetchLastInventoryRun(): Promise<LastInventoryRun | null> {
  const { data: runs, error } = await supabase
    .from('inventory_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!runs?.length) return null;

  const run = runs[0] as InventoryRun;

  let runnerName = 'Unknown';
  if (run.user_id) {
    // Legacy ignores profile fetch errors — name falls back to 'Unknown'.
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', run.user_id)
      .single();
    if (profile) {
      runnerName =
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
    }
  }

  // Legacy renders the run summary even when the checks query fails — an
  // error here must not collapse an existing run into the empty state.
  const { data: checks } = await supabase
    .from('inventory_checks')
    .select('*, inventory_items:item_id(name, location, image_url)')
    .eq('run_id', run.id)
    .order('checked_at');

  return { run, runnerName, checks: (checks ?? []) as InventoryCheckWithItem[] };
}

export interface SubmitCheckInput {
  item_id: string;
  status: InventoryStatus;
  notes: string | null;
  photo_url: string | null;
}

/**
 * One-shot run model (legacy parity): the run row is inserted already
 * completed, then all checks are bulk-inserted. Non-transactional — if the
 * checks insert fails the orphan run row remains (matches legacy).
 */
export async function submitInventoryRun(params: {
  userId: string;
  checks: SubmitCheckInput[];
}): Promise<InventoryRun> {
  const { data: run, error: runError } = await supabase
    .from('inventory_runs')
    .insert({ user_id: params.userId, completed_at: new Date().toISOString() })
    .select()
    .single();
  if (runError) throw runError;

  if (params.checks.length) {
    const rows = params.checks.map((c) => ({ ...c, run_id: (run as InventoryRun).id }));
    const { error: checksError } = await supabase.from('inventory_checks').insert(rows);
    if (checksError) throw checksError;
  }

  return run as InventoryRun;
}
