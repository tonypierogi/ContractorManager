import { supabase } from '@/lib/supabase';
import { uploadImageToMediaBucket, type UploadImageInput } from '@/lib/uploads';
import type {
  SopTemplate,
  SopItem,
  DailySop,
  SopTaskComment,
  AdHocTask,
} from '@/types/database';

export type DailySopWithTemplate = DailySop & {
  sop_templates: { name: string } | null;
};

export interface SopChecklistItem extends SopItem {
  checked: boolean;
  checked_by: string | null;
  checked_by_name: string | null;
  _adHoc?: boolean;
}

export interface SaveSopTemplateInput {
  id?: string;
  name: string;
  description?: string;
  items: Array<{
    title: string;
    description?: string;
    item_type?: string;
    media?: unknown[];
    equipment?: string[];
    sort_order: number;
  }>;
}

/** SOP item media goes to the bucket root under the uploader's user id
 * (`{userId}/{ts}-{name}`), matching legacy media paths. */
export function uploadSopMedia(params: UploadImageInput): Promise<string> {
  return uploadImageToMediaBucket('', params);
}

export async function fetchSopTemplates(): Promise<SopTemplate[]> {
  const { data, error } = await supabase
    .from('sop_templates')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as SopTemplate[];
}

export async function fetchSopTemplate(id: string) {
  const [templateResult, itemsResult] = await Promise.all([
    supabase.from('sop_templates').select('*').eq('id', id).single(),
    supabase
      .from('sop_items')
      .select('*')
      .eq('sop_template_id', id)
      .order('sort_order'),
  ]);
  if (templateResult.error) throw templateResult.error;
  if (itemsResult.error) throw itemsResult.error;
  return {
    template: templateResult.data as SopTemplate,
    items: itemsResult.data as SopItem[],
  };
}

export async function saveSopTemplate({
  id,
  name,
  description,
  items,
}: SaveSopTemplateInput): Promise<string> {
  let templateId = id;

  if (id) {
    const { error: updateErr } = await supabase
      .from('sop_templates')
      .update({ name, description })
      .eq('id', id);
    if (updateErr) throw updateErr;

    const { error: deleteErr } = await supabase
      .from('sop_items')
      .delete()
      .eq('sop_template_id', id);
    if (deleteErr) throw deleteErr;
  } else {
    const { data, error } = await supabase
      .from('sop_templates')
      .insert({ name, description })
      .select('id')
      .single();
    if (error) throw error;
    templateId = data.id;
  }

  const rows = items
    .filter((item) => item.title?.trim())
    .map((item) => ({
      sop_template_id: templateId,
      sort_order: item.sort_order,
      title: item.title.trim(),
      description: item.description?.trim() || null,
      item_type: item.item_type || 'task',
      media: item.media || [],
      equipment: item.equipment || [],
    }));
  if (rows.length > 0) {
    const { error } = await supabase.from('sop_items').insert(rows);
    if (error) throw error;
  }

  return templateId!;
}

/** Copies a template and its items (media, equipment) for tweak-and-reuse. */
export async function duplicateSopTemplate(id: string): Promise<string> {
  const { template, items } = await fetchSopTemplate(id);

  const { data, error } = await supabase
    .from('sop_templates')
    .insert({
      name: `${template.name} (Copy)`,
      description: template.description,
    })
    .select('id')
    .single();
  if (error) throw error;
  const newId = data.id as string;

  if (items.length > 0) {
    const rows = items.map((it) => ({
      sop_template_id: newId,
      sort_order: it.sort_order,
      title: it.title,
      description: it.description,
      item_type: it.item_type ?? 'task',
      media: it.media ?? [],
      equipment: it.equipment ?? [],
    }));
    const { error: itemsError } = await supabase.from('sop_items').insert(rows);
    if (itemsError) throw itemsError;
  }

  return newId;
}

export async function deleteSopTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('sop_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTodayDailySop(): Promise<DailySopWithTemplate | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_sops')
    .select('*, sop_templates(name)')
    .eq('date', today)
    .order('completed_at', { ascending: true, nullsFirst: true })
    .limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as DailySopWithTemplate | null;
}

export async function createDailySop(input: {
  sopTemplateId: string;
  createdBy: string;
}): Promise<DailySopWithTemplate> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_sops')
    .insert({
      date: today,
      sop_template_id: input.sopTemplateId,
      created_by: input.createdBy,
    })
    .select('*, sop_templates(name)')
    .single();
  if (error) throw error;
  return data as DailySopWithTemplate;
}

export async function fetchSopChecklist(dailySopId: string, sopTemplateId?: string) {
  // Callers that already hold the daily SOP row pass its template id and
  // skip a serial round trip.
  let templateId = sopTemplateId;
  if (!templateId) {
    const { data: daily } = await supabase
      .from('daily_sops')
      .select('sop_template_id')
      .eq('id', dailySopId)
      .single();
    if (!daily) throw new Error('Daily SOP not found');
    templateId = daily.sop_template_id as string;
  }

  const [itemsResult, adHocResult, checksResult] = await Promise.all([
    supabase
      .from('sop_items')
      .select('*')
      .eq('sop_template_id', templateId)
      .order('sort_order'),
    supabase
      .from('ad_hoc_tasks')
      .select('*')
      .eq('daily_sop_id', dailySopId)
      .order('created_at'),
    supabase
      .from('sop_item_checks')
      .select('sop_item_id, checked_by, checked_at, profiles(first_name, last_name)')
      .eq('daily_sop_id', dailySopId),
  ]);

  const checkMap: Record<string, { checked_by: string; name: string }> = {};
  (checksResult.data ?? []).forEach((c: any) => {
    const name = c.profiles
      ? `${c.profiles.first_name || ''} ${c.profiles.last_name || ''}`.trim()
      : '';
    if (c.sop_item_id) {
      checkMap[c.sop_item_id] = { checked_by: c.checked_by, name };
    }
  });

  const templateItems: SopChecklistItem[] = (itemsResult.data ?? []).map(
    (item: any) => ({
      ...item,
      checked: !!checkMap[item.id],
      checked_by: checkMap[item.id]?.checked_by ?? null,
      checked_by_name: checkMap[item.id]?.name ?? null,
    }),
  );

  const adHocItems: AdHocTask[] = adHocResult.data ?? [];

  return { templateItems, adHocItems };
}

export async function toggleSopCheck(input: {
  dailySopId: string;
  sopItemId: string;
  checkedBy: string;
  checked: boolean;
}): Promise<void> {
  if (input.checked) {
    const { error } = await supabase.from('sop_item_checks').insert({
      daily_sop_id: input.dailySopId,
      sop_item_id: input.sopItemId,
      checked_by: input.checkedBy,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('sop_item_checks')
      .delete()
      .eq('daily_sop_id', input.dailySopId)
      .eq('sop_item_id', input.sopItemId);
    if (error) throw error;
  }
}

export async function completeDailySop(dailySopId: string): Promise<void> {
  const { error } = await supabase
    .from('daily_sops')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', dailySopId);
  if (error) throw error;
}

export async function fetchCompletedDailySops() {
  const { data, error } = await supabase
    .from('daily_sops')
    .select('*, sop_templates(name)')
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(15);
  if (error) throw error;
  return data as DailySopWithTemplate[];
}

export async function fetchSopTaskComments(
  dailySopId: string,
  itemId?: string,
): Promise<SopTaskComment[]> {
  let query = supabase
    .from('sop_task_comments')
    .select('*')
    .eq('daily_sop_id', dailySopId)
    .order('created_at', { ascending: false });

  if (itemId) {
    query = query.eq('sop_item_id', itemId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as SopTaskComment[];
}

export async function addSopComment(input: {
  sopItemId: string;
  dailySopId: string;
  comment: string;
  authorId: string;
}): Promise<SopTaskComment> {
  const { data, error } = await supabase
    .from('sop_task_comments')
    .insert({
      sop_item_id: input.sopItemId,
      daily_sop_id: input.dailySopId,
      comment: input.comment,
      author_id: input.authorId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SopTaskComment;
}

export async function fetchAdHocTasks(dailySopId: string): Promise<AdHocTask[]> {
  const { data, error } = await supabase
    .from('ad_hoc_tasks')
    .select('*')
    .eq('daily_sop_id', dailySopId)
    .order('sort_order');
  if (error) throw error;
  return data as AdHocTask[];
}

export async function addAdHocTask(input: {
  dailySopId: string;
  title: string;
  createdBy: string;
}): Promise<AdHocTask> {
  const { data, error } = await supabase
    .from('ad_hoc_tasks')
    .insert({
      daily_sop_id: input.dailySopId,
      title: input.title,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data as AdHocTask;
}

export async function toggleAdHocTask(input: {
  taskId: string;
  completedBy: string;
}): Promise<void> {
  const { data: existing } = await supabase
    .from('ad_hoc_tasks')
    .select('completed_by')
    .eq('id', input.taskId)
    .single();

  if (existing?.completed_by) {
    const { error } = await supabase
      .from('ad_hoc_tasks')
      .update({ completed_by: null, completed_at: null })
      .eq('id', input.taskId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('ad_hoc_tasks')
      .update({
        completed_by: input.completedBy,
        completed_at: new Date().toISOString(),
      })
      .eq('id', input.taskId);
    if (error) throw error;
  }
}
