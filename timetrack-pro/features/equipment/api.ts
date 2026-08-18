import { supabase } from '@/lib/supabase';
import { uploadImageToMediaBucket, type UploadImageInput } from '@/lib/uploads';
import { parseAnnotations, type ImageAnnotation } from '@/lib/annotations';
import type { Equipment, EquipmentTag } from '@/types/database';

/** The equipment row as it comes back from the database, before tags join on. */
type EquipmentRow = Omit<Equipment, 'tag_ids' | 'image_annotations'> & {
  image_annotations?: unknown;
};

export type SaveEquipmentInput = {
  id?: string;
  name: string;
  location?: string | null;
  image_url?: string | null;
  /** Marks drawn over image_url; null clears them. */
  image_annotations?: ImageAnnotation[] | null;
  created_by?: string;
  /** Full set of tags for the item; omit to leave existing tags untouched. */
  tag_ids?: string[];
};

/**
 * "That table isn't there": Postgres' relation-does-not-exist, and PostgREST's
 * own code for a table missing from its schema cache. See readTagsSafely().
 */
const MISSING_TABLE_CODES = ['42P01', 'PGRST205'];

/**
 * "That column isn't there": Postgres' undefined-column, and PostgREST's code
 * for a column missing from its schema cache. See saveEquipment() — the
 * annotations column arrives in a migration applied by hand, so a write has to
 * survive reaching a database that hasn't had it yet.
 */
const MISSING_COLUMN_CODES = ['42703', 'PGRST204'];

function isMissingColumn(error: { code?: string } | null): boolean {
  return !!error?.code && MISSING_COLUMN_CODES.includes(error.code);
}

/** Fill in the fields the row may not carry yet, and normalise the JSON one. */
function toEquipmentRow(row: EquipmentRow): Omit<Equipment, 'tag_ids'> {
  return { ...row, image_annotations: parseAnnotations(row.image_annotations) };
}

/**
 * Tag reads are best-effort. Migrations here are applied by hand, so the app
 * ships before 20260818140000_equipment_tags.sql lands: until it does, the
 * equipment list has to keep working with no tags rather than fail to load.
 * Only the missing-table error is swallowed — anything else (offline, RLS)
 * still surfaces.
 */
async function readTagsSafely<T>(
  read: () => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>,
  fallback: T[] = [],
): Promise<T[]> {
  const { data, error } = await read();
  if (error) {
    if (error.code && MISSING_TABLE_CODES.includes(error.code)) return fallback;
    throw error;
  }
  return data ?? fallback;
}

/** equipment id -> the tags on it. */
async function fetchEquipmentTagLinks(): Promise<Map<string, string[]>> {
  const rows = await readTagsSafely<{ equipment_id: string; tag_id: string }>(() =>
    supabase.from('equipment_tag_links').select('equipment_id, tag_id'),
  );
  const byEquipment = new Map<string, string[]>();
  rows.forEach((row) => {
    const tags = byEquipment.get(row.equipment_id);
    if (tags) tags.push(row.tag_id);
    else byEquipment.set(row.equipment_id, [row.tag_id]);
  });
  return byEquipment;
}

export async function fetchEquipment(): Promise<Equipment[]> {
  // Links come from their own table rather than an embedded select so the list
  // still loads on a database that hasn't got the tag tables yet.
  const [{ data, error }, links] = await Promise.all([
    supabase.from('equipment').select('*').order('name'),
    fetchEquipmentTagLinks(),
  ]);
  if (error) throw error;

  return (data as EquipmentRow[]).map((row) => ({
    ...toEquipmentRow(row),
    tag_ids: links.get(row.id) ?? [],
  }));
}

/**
 * Bring the item's links in line with `tagIds`: add what's new, drop what was
 * unticked, leave the rest alone (so re-saving an unchanged item is a no-op).
 */
async function syncEquipmentTagLinks(
  equipmentId: string,
  tagIds: string[],
): Promise<void> {
  const existing = await readTagsSafely<{ tag_id: string }>(() =>
    supabase.from('equipment_tag_links').select('tag_id').eq('equipment_id', equipmentId),
  );

  const next = new Set(tagIds);
  const previous = new Set(existing.map((row) => row.tag_id));
  const added = [...next].filter((id) => !previous.has(id));
  const removed = [...previous].filter((id) => !next.has(id));

  if (removed.length) {
    const { error } = await supabase
      .from('equipment_tag_links')
      .delete()
      .eq('equipment_id', equipmentId)
      .in('tag_id', removed);
    if (error) throw error;
  }

  if (added.length) {
    const { error } = await supabase
      .from('equipment_tag_links')
      .insert(added.map((tag_id) => ({ equipment_id: equipmentId, tag_id })));
    if (error) throw error;
  }
}

export async function saveEquipment(equipment: SaveEquipmentInput): Promise<Equipment> {
  const { tag_ids, ...row } = equipment;

  const saved = await (async (): Promise<EquipmentRow> => {
    // Written twice at most: once as asked, and — only if this database
    // predates the annotations migration — again without that column, so the
    // rest of the edit still saves rather than the whole form failing.
    const write = async (values: Record<string, unknown>) => {
      if (values.id) {
        const { id, created_by, ...updates } = values;
        return supabase.from('equipment').update(updates).eq('id', id as string).select().single();
      }
      return supabase.from('equipment').insert(values).select().single();
    };

    const { data, error } = await write(row);
    if (!error) return data as EquipmentRow;
    if (!isMissingColumn(error) || !('image_annotations' in row)) throw error;

    const { image_annotations, ...withoutAnnotations } = row;
    const retry = await write(withoutAnnotations);
    if (retry.error) throw retry.error;
    return retry.data as EquipmentRow;
  })();

  if (tag_ids) await syncEquipmentTagLinks(saved.id, tag_ids);

  return { ...toEquipmentRow(saved), tag_ids: tag_ids ?? [] };
}

export function uploadEquipmentImage(params: UploadImageInput): Promise<string> {
  return uploadImageToMediaBucket('equipment', params);
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw error;
}

/** Every tag an admin has defined, in the order the chips are shown. */
export async function fetchEquipmentTags(): Promise<EquipmentTag[]> {
  return readTagsSafely<EquipmentTag>(() =>
    supabase.from('equipment_tags').select('*').order('name'),
  );
}

export type SaveEquipmentTagInput = {
  /** Omit to create a tag; pass it to rename one. */
  id?: string;
  name: string;
};

export async function saveEquipmentTag(
  input: SaveEquipmentTagInput,
): Promise<EquipmentTag> {
  const name = input.name.trim();

  if (input.id) {
    const { data, error } = await supabase
      .from('equipment_tags')
      .update({ name })
      .eq('id', input.id)
      .select()
      .single();
    if (error) throw error;
    return data as EquipmentTag;
  }

  const { data, error } = await supabase
    .from('equipment_tags')
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data as EquipmentTag;
}

/** Deleting a tag drops it off every item it was on (links cascade). */
export async function deleteEquipmentTag(id: string): Promise<void> {
  const { error } = await supabase.from('equipment_tags').delete().eq('id', id);
  if (error) throw error;
}
