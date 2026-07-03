import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  TaskList,
  TaskListItem,
  TaskListAssignment,
  TaskListItemCheck,
} from '@/types/database';

export function useTaskLists() {
  return useQuery({
    queryKey: ['taskLists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_lists')
        .select('*, task_list_items(id), task_list_assignments(id, status)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTaskList(id: string) {
  return useQuery({
    queryKey: ['taskList', id],
    queryFn: async () => {
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
    },
    enabled: !!id,
  });
}

export function useSaveTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      description,
      isSop,
      sourceVideoUrl,
      sourceTranscript,
      createdBy,
      items,
    }: {
      id?: string;
      title: string;
      description?: string;
      isSop?: boolean;
      sourceVideoUrl?: string | null;
      sourceTranscript?: string | null;
      createdBy?: string;
      items: Array<{
        title: string;
        description?: string;
        media?: unknown[];
      }>;
    }) => {
      const payload = {
        title,
        description: description || null,
        is_sop: isSop ?? false,
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
        }));
        const { error } = await supabase.from('task_list_items').insert(rows);
        if (error) throw error;
      }

      return taskListId!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskLists'] });
      queryClient.invalidateQueries({ queryKey: ['taskList'] });
    },
  });
}

export function useDeleteTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('task_lists')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskLists'] });
    },
  });
}

export function useTaskListAssignments(taskListId: string) {
  return useQuery({
    queryKey: ['taskListAssignments', taskListId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_list_assignments')
        .select('*, profiles!task_list_assignments_assigned_to_fkey(first_name, last_name)')
        .eq('task_list_id', taskListId);
      if (error) throw error;
      return data;
    },
    enabled: !!taskListId,
  });
}

export function useSaveAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskListId,
      assignedTo,
      assignedBy,
    }: {
      taskListId: string;
      assignedTo: string[];
      assignedBy: string;
    }) => {
      const rows = assignedTo.map((userId) => ({
        task_list_id: taskListId,
        assigned_to: userId,
        assigned_by: assignedBy,
        status: 'pending' as const,
      }));
      const { error } = await supabase.from('task_list_assignments').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_data, { taskListId }) => {
      queryClient.invalidateQueries({ queryKey: ['taskListAssignments', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['taskLists'] });
      queryClient.invalidateQueries({ queryKey: ['myTaskAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['pendingTaskAssignments'] });
    },
  });
}

export function useMyTaskAssignments(userId: string) {
  return useQuery({
    queryKey: ['myTaskAssignments', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_list_assignments')
        .select('*, task_lists(id, title, description, is_sop, source_video_url), task_list_item_checks(id)')
        .eq('assigned_to', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export interface TaskChecklistItemWithCheck extends TaskListItem {
  checked: boolean;
}

export function useTaskChecklistItems(assignmentId: string) {
  return useQuery({
    queryKey: ['taskChecklistItems', assignmentId],
    queryFn: async () => {
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
    },
    enabled: !!assignmentId,
  });
}

export function useToggleTaskCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      taskListItemId,
      checkedBy,
    }: {
      assignmentId: string;
      taskListItemId: string;
      checkedBy: string;
    }) => {
      const { error } = await supabase.from('task_list_item_checks').insert({
        assignment_id: assignmentId,
        task_list_item_id: taskListItemId,
        checked_by: checkedBy,
      });
      if (error) throw error;

      const { data: checks } = await supabase
        .from('task_list_item_checks')
        .select('id')
        .eq('assignment_id', assignmentId);

      const { data: assignment } = await supabase
        .from('task_list_assignments')
        .select('task_list_id')
        .eq('id', assignmentId)
        .single();

      if (assignment) {
        const { data: items } = await supabase
          .from('task_list_items')
          .select('id')
          .eq('task_list_id', assignment.task_list_id);

        const checkedCount = checks?.length ?? 0;
        const totalCount = items?.length ?? 0;

        if (checkedCount === totalCount && totalCount > 0) {
          await supabase
            .from('task_list_assignments')
            .update({ status: 'completed' })
            .eq('id', assignmentId);
        } else if (checkedCount === 1) {
          await supabase
            .from('task_list_assignments')
            .update({ status: 'in_progress' })
            .eq('id', assignmentId);
        }
      }
    },
    onSuccess: (_data, { assignmentId }) => {
      queryClient.invalidateQueries({ queryKey: ['taskChecklistItems', assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['myTaskAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['pendingTaskAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['taskLists'] });
    },
  });
}

export function usePendingTaskAssignments(userId: string) {
  return useQuery({
    queryKey: ['pendingTaskAssignments', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_list_assignments')
        .select('*, task_lists(title, description)')
        .eq('assigned_to', userId)
        .in('status', ['pending', 'in_progress']);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
