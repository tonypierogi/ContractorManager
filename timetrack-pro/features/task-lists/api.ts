import { supabase } from '@/lib/supabase';
import {
  uploadImageToMediaBucket,
  uploadVideoToMediaBucket,
  type UploadImageInput,
  type UploadVideoInput,
} from '@/lib/uploads';
import type { MediaItem, TaskList, TaskListItem } from '@/types/database';

/** Item media images go to the bucket root under the uploader's user id
 * (`{userId}/{ts}-{name}`), matching legacy SOP/task-list media paths. */
export function uploadTaskListMedia(params: UploadImageInput): Promise<string> {
  return uploadImageToMediaBucket('', params);
}

export interface GeneratedTaskItem {
  title: string;
  description: string;
  /** Seconds into the source video where the speaker asked for a capture. */
  video_timestamp: number | null;
}

export interface VideoImportResult {
  videoUrl: string;
  transcript: string;
  items: GeneratedTaskItem[];
}

export interface ImportTaskVideoInput extends UploadVideoInput {
  /** Reports the current step so the editor can show what's taking time. */
  onStage?: (stage: string) => void;
}

/**
 * functions.invoke flattens every non-2xx into the same generic message; the
 * edge function's actual reason (no API key, video too long) is in the body.
 */
async function edgeFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
    } catch {
      // non-JSON body — fall through to the generic message
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Upload a walkthrough video, then transcribe it and turn it into draft tasks
 * via the process-task-video edge function.
 *
 * The legacy web app also grabbed a still per "capture" keyword using
 * ffmpeg.wasm + a canvas, neither of which exists in React Native. Each task
 * instead keeps the capture's `video_timestamp`, so the checklist can point at
 * the moment in the stored source video.
 */
export async function importTaskVideo({
  onStage,
  ...upload
}: ImportTaskVideoInput): Promise<VideoImportResult> {
  onStage?.('Uploading video…');
  const videoUrl = await uploadVideoToMediaBucket(upload);

  onStage?.('Transcribing and generating tasks…');
  const { data, error } = await supabase.functions.invoke('process-task-video', {
    body: { video_url: videoUrl },
  });
  if (error) {
    throw new Error(
      await edgeFunctionErrorMessage(error, 'Video processing failed'),
    );
  }
  if (data?.error) throw new Error(String(data.error));

  const captureTimestamps: number[] = data?.capture_timestamps ?? [];
  const tasks: Array<{
    title?: string;
    description?: string;
    capture_indices?: number[];
  }> = data?.tasks ?? [];

  const items = tasks.map((task, idx) => {
    const firstCapture = (task.capture_indices ?? []).find(
      (ci) => captureTimestamps[ci] != null,
    );
    return {
      title: task.title?.trim() || `Task ${idx + 1}`,
      description: task.description?.trim() ?? '',
      video_timestamp:
        firstCapture != null ? captureTimestamps[firstCapture] : null,
    };
  });

  return { videoUrl, transcript: data?.transcript ?? '', items };
}

export interface TaskChecklistItemWithCheck extends TaskListItem {
  checked: boolean;
}

export interface SaveTaskListInput {
  id?: string;
  title: string;
  description?: string;
  isSop?: boolean;
  location?: string | null;
  sourceVideoUrl?: string | null;
  sourceTranscript?: string | null;
  createdBy?: string;
  items: Array<{
    title: string;
    description?: string;
    media?: unknown[];
    item_type?: string | null;
    location_from?: string | null;
    location_to?: string | null;
    equipment?: string[];
    video_timestamp?: number | null;
  }>;
}

export async function fetchTaskLists() {
  // Explicit columns: task_lists.* would drag the full video transcript of
  // every list into this list view.
  const { data, error } = await supabase
    .from('task_lists')
    .select(
      'id, title, description, is_sop, source_video_url, created_at, task_list_items(id), task_list_assignments(id, status)',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** A task from any task list or SOP, normalized so the editor's
 * "add from existing" picker can search and copy across both systems. */
export interface TemplateItemRef {
  key: string;
  source: 'task_list' | 'sop';
  sourceTitle: string;
  sourceLocation: string | null;
  title: string;
  description: string | null;
  item_type: string | null;
  media: MediaItem[];
  location_from: string | null;
  location_to: string | null;
  equipment: string[];
}

export async function fetchAllTemplateItems(): Promise<TemplateItemRef[]> {
  const [taskItems, sopItems] = await Promise.all([
    supabase
      .from('task_list_items')
      .select(
        'id, title, description, item_type, media, location_from, location_to, equipment, task_lists(title, location)',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('sop_items')
      .select('id, title, description, item_type, media, equipment, sop_templates(name)')
      .order('created_at', { ascending: false }),
  ]);
  if (taskItems.error) throw taskItems.error;
  if (sopItems.error) throw sopItems.error;

  const fromLists: TemplateItemRef[] = (taskItems.data ?? []).map((it: any) => ({
    key: `tl-${it.id}`,
    source: 'task_list',
    sourceTitle: it.task_lists?.title ?? 'Task list',
    sourceLocation: it.task_lists?.location ?? null,
    title: it.title,
    description: it.description,
    item_type: it.item_type,
    media: it.media ?? [],
    location_from: it.location_from,
    location_to: it.location_to,
    equipment: it.equipment ?? [],
  }));
  const fromSops: TemplateItemRef[] = (sopItems.data ?? [])
    .filter((it: any) => it.item_type !== 'section')
    .map((it: any) => ({
      key: `sop-${it.id}`,
      source: 'sop',
      sourceTitle: it.sop_templates?.name ?? 'SOP',
      sourceLocation: null,
      title: it.title,
      description: it.description,
      item_type: 'task',
      media: it.media ?? [],
      location_from: null,
      location_to: null,
      equipment: it.equipment ?? [],
    }));
  return [...fromLists, ...fromSops];
}

export async function fetchTaskList(id: string) {
  const [listResult, itemsResult] = await Promise.all([
    supabase.from('task_lists').select('*').eq('id', id).single(),
    supabase
      .from('task_list_items')
      .select('*')
      .eq('task_list_id', id)
      .order('sort_order'),
  ]);
  if (listResult.error) throw listResult.error;
  if (itemsResult.error) throw itemsResult.error;
  return {
    taskList: listResult.data as TaskList,
    items: itemsResult.data as TaskListItem[],
  };
}

export async function saveTaskList({
  id,
  title,
  description,
  isSop,
  location,
  sourceVideoUrl,
  sourceTranscript,
  createdBy,
  items,
}: SaveTaskListInput): Promise<string> {
  const payload = {
    title,
    description: description || null,
    is_sop: isSop ?? false,
    location: location ?? null,
    source_video_url: sourceVideoUrl || null,
    source_transcript: sourceTranscript || null,
  };

  let taskListId = id;

  if (id) {
    const { error } = await supabase
      .from('task_lists')
      .update(payload)
      .eq('id', id);
    if (error) throw error;

    await supabase.from('task_list_items').delete().eq('task_list_id', id);
  } else {
    const { data, error } = await supabase
      .from('task_lists')
      .insert({ ...payload, created_by: createdBy })
      .select()
      .single();
    if (error) throw error;
    taskListId = data.id;
  }

  const validItems = items.filter((it) => it.title.trim());
  if (validItems.length > 0) {
    const rows = validItems.map((it, idx) => ({
      task_list_id: taskListId,
      sort_order: idx,
      title: it.title.trim(),
      description: it.description?.trim() || null,
      media: it.media || [],
      item_type: it.item_type || 'task',
      location_from: it.location_from ?? null,
      location_to: it.location_to ?? null,
      equipment: it.equipment ?? [],
      video_timestamp: it.video_timestamp ?? null,
    }));
    const { error } = await supabase.from('task_list_items').insert(rows);
    if (error) throw error;
  }

  return taskListId!;
}

/** Copies a list and all its items — media URLs, locations, equipment tags —
 * so an admin can tweak the copy and reassign it without rebuilding. */
export async function duplicateTaskList(input: {
  id: string;
  createdBy: string;
}): Promise<string> {
  const { taskList, items } = await fetchTaskList(input.id);

  const { data, error } = await supabase
    .from('task_lists')
    .insert({
      title: `${taskList.title} (Copy)`,
      description: taskList.description,
      is_sop: taskList.is_sop,
      location: taskList.location,
      source_video_url: taskList.source_video_url,
      source_transcript: taskList.source_transcript,
      created_by: input.createdBy,
    })
    .select('id')
    .single();
  if (error) throw error;
  const newId = data.id as string;

  if (items.length > 0) {
    const rows = items.map((it) => ({
      task_list_id: newId,
      sort_order: it.sort_order,
      title: it.title,
      description: it.description,
      media: it.media ?? [],
      item_type: it.item_type ?? 'task',
      location_from: it.location_from ?? null,
      location_to: it.location_to ?? null,
      equipment: it.equipment ?? [],
      video_timestamp: it.video_timestamp ?? null,
    }));
    const { error: itemsError } = await supabase
      .from('task_list_items')
      .insert(rows);
    if (itemsError) throw itemsError;
  }

  return newId;
}

export async function deleteTaskList(id: string): Promise<void> {
  const { error } = await supabase.from('task_lists').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTaskListAssignments(taskListId: string) {
  // scheduled_shifts embed requires the task_list_assignments.shift_id column
  // (migration 20260812090000_task_assignment_shift.sql).
  const { data, error } = await supabase
    .from('task_list_assignments')
    .select(
      '*, profiles!task_list_assignments_assigned_to_fkey(first_name, last_name), scheduled_shifts(id, shift_date, start_time, end_time)',
    )
    .eq('task_list_id', taskListId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveAssignments(input: {
  taskListId: string;
  assignedTo: string[];
  assignedBy: string;
  /** Optional scheduled_shifts id to pin the assignment to a specific shift. */
  shiftId?: string | null;
}): Promise<void> {
  const rows = input.assignedTo.map((userId) => ({
    task_list_id: input.taskListId,
    assigned_to: userId,
    assigned_by: input.assignedBy,
    status: 'pending' as const,
    // Only sent when set so plain assignments keep working before the
    // shift_id migration is applied.
    ...(input.shiftId ? { shift_id: input.shiftId } : {}),
  }));
  const { error } = await supabase.from('task_list_assignments').insert(rows);
  if (error) throw error;
}

export async function fetchMyTaskAssignments(userId: string) {
  const { data, error } = await supabase
    .from('task_list_assignments')
    .select(
      '*, task_lists(id, title, description, is_sop, source_video_url), task_list_item_checks(id)',
    )
    .eq('assigned_to', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchTaskChecklist(assignmentId: string) {
  const { data: assignment } = await supabase
    .from('task_list_assignments')
    .select('*, task_lists(id, title, description, source_video_url)')
    .eq('id', assignmentId)
    .single();
  if (!assignment) throw new Error('Assignment not found');

  const taskListId = assignment.task_lists?.id ?? assignment.task_list_id;

  const [itemsResult, checksResult] = await Promise.all([
    supabase
      .from('task_list_items')
      .select('*')
      .eq('task_list_id', taskListId)
      .order('sort_order'),
    supabase
      .from('task_list_item_checks')
      .select('*')
      .eq('assignment_id', assignmentId),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (checksResult.error) throw checksResult.error;

  const checkMap: Record<string, boolean> = {};
  (checksResult.data ?? []).forEach((c: any) => {
    checkMap[c.task_list_item_id] = true;
  });

  const items: TaskChecklistItemWithCheck[] = (itemsResult.data ?? []).map(
    (item: any) => ({
      ...item,
      checked: !!checkMap[item.id],
    }),
  );

  return {
    assignment,
    taskList: assignment.task_lists,
    items,
    checkedCount: Object.keys(checkMap).length,
    totalCount: items.length,
  };
}

/**
 * Insert a check, then derive the assignment status from the counts the
 * caller already holds (from the cached checklist) — 2 requests per tap
 * instead of the previous 5-request refetch chain.
 */
export async function toggleTaskCheck(input: {
  assignmentId: string;
  taskListItemId: string;
  checkedBy: string;
  checkedCountAfter?: number;
  totalCount?: number;
}): Promise<void> {
  const { error } = await supabase.from('task_list_item_checks').insert({
    assignment_id: input.assignmentId,
    task_list_item_id: input.taskListItemId,
    checked_by: input.checkedBy,
  });
  if (error) throw error;

  let checkedCount = input.checkedCountAfter;
  let totalCount = input.totalCount;

  // Fallback for callers that don't know the counts: fetch them.
  if (checkedCount == null || totalCount == null) {
    const { data: checks } = await supabase
      .from('task_list_item_checks')
      .select('id')
      .eq('assignment_id', input.assignmentId);
    const { data: assignment } = await supabase
      .from('task_list_assignments')
      .select('task_list_id')
      .eq('id', input.assignmentId)
      .single();
    if (!assignment) return;
    const { data: items } = await supabase
      .from('task_list_items')
      .select('id')
      .eq('task_list_id', assignment.task_list_id);
    checkedCount = checks?.length ?? 0;
    totalCount = items?.length ?? 0;
  }

  if (checkedCount === totalCount && totalCount > 0) {
    await supabase
      .from('task_list_assignments')
      .update({ status: 'completed' })
      .eq('id', input.assignmentId);
  } else if (checkedCount === 1) {
    await supabase
      .from('task_list_assignments')
      .update({ status: 'in_progress' })
      .eq('id', input.assignmentId);
  }
}

export async function fetchPendingTaskAssignments(userId: string) {
  const { data, error } = await supabase
    .from('task_list_assignments')
    .select('*, task_lists(title, description)')
    .eq('assigned_to', userId)
    .in('status', ['pending', 'in_progress']);
  if (error) throw error;
  return data;
}
