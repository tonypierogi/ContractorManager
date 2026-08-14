import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  deleteRecurrence,
  deleteTaskList,
  duplicateTaskList,
  fetchAllTemplateItems,
  fetchMyTaskAssignments,
  fetchPendingTaskAssignments,
  fetchTaskChecklist,
  fetchTaskList,
  fetchTaskListAssignments,
  fetchTaskListRecurrences,
  fetchTaskLists,
  importTaskVideo,
  saveAssignments,
  saveRecurrence,
  saveTaskList,
  toggleTaskCheck,
  uploadTaskListMedia,
  type TaskChecklistItemWithCheck,
} from './api';

export function useUploadTaskListMedia() {
  return useMutation({ mutationFn: uploadTaskListMedia });
}

/** Upload + transcribe a walkthrough video into draft tasks. Nothing is
 * persisted until the editor is saved, so no cache invalidation here. */
export function useImportTaskVideo() {
  return useMutation({ mutationFn: importTaskVideo });
}

export type { TaskChecklistItemWithCheck };

/** Every task across all task lists and SOPs, for the "add from existing"
 * picker. Gated on `enabled` so it only fetches while the picker is open. */
export function useAllTemplateItems(enabled = true) {
  return useQuery({
    queryKey: qk.taskLists.templateItems,
    queryFn: fetchAllTemplateItems,
    enabled,
  });
}

export function useTaskLists() {
  return useQuery({
    queryKey: qk.taskLists.list,
    queryFn: fetchTaskLists,
  });
}

export function useTaskList(id: string) {
  return useQuery({
    queryKey: qk.taskLists.detail(id),
    queryFn: () => fetchTaskList(id),
    enabled: !!id,
  });
}

export function useSaveTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveTaskList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.taskLists.all });
      // the Locations screen's linked-tasks panel reads task_lists too
      queryClient.invalidateQueries({ queryKey: qk.locations.all });
    },
  });
}

export function useDuplicateTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateTaskList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.taskLists.all });
      queryClient.invalidateQueries({ queryKey: qk.locations.all });
    },
  });
}

export function useDeleteTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTaskList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.taskLists.all });
      queryClient.invalidateQueries({ queryKey: qk.locations.all });
    },
  });
}

export function useTaskListAssignments(taskListId: string) {
  return useQuery({
    queryKey: qk.taskLists.assignments(taskListId),
    queryFn: () => fetchTaskListAssignments(taskListId),
    enabled: !!taskListId,
  });
}

export function useSaveAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveAssignments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.taskLists.all });
      queryClient.invalidateQueries({ queryKey: qk.locations.all });
    },
  });
}

export function useTaskListRecurrences(taskListId: string) {
  return useQuery({
    queryKey: qk.taskLists.recurrences(taskListId),
    queryFn: () => fetchTaskListRecurrences(taskListId),
    enabled: !!taskListId,
  });
}

export function useSaveRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveRecurrence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.taskLists.all });
    },
  });
}

export function useDeleteRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRecurrence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.taskLists.all });
    },
  });
}

export function useMyTaskAssignments(userId: string) {
  return useQuery({
    queryKey: qk.taskLists.mineFor(userId),
    queryFn: () => fetchMyTaskAssignments(userId),
    enabled: !!userId,
  });
}

export function useTaskChecklistItems(assignmentId: string) {
  return useQuery({
    queryKey: qk.taskLists.checklist(assignmentId),
    queryFn: () => fetchTaskChecklist(assignmentId),
    enabled: !!assignmentId,
  });
}

export function useToggleTaskCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleTaskCheck,
    onSuccess: (_data, { assignmentId }) => {
      queryClient.invalidateQueries({ queryKey: qk.taskLists.checklist(assignmentId) });
      queryClient.invalidateQueries({ queryKey: qk.taskLists.mine });
      queryClient.invalidateQueries({ queryKey: qk.taskLists.pending });
      queryClient.invalidateQueries({ queryKey: qk.taskLists.list });
    },
  });
}

export function usePendingTaskAssignments(userId: string) {
  return useQuery({
    queryKey: qk.taskLists.pendingFor(userId),
    queryFn: () => fetchPendingTaskAssignments(userId),
    enabled: !!userId,
  });
}
