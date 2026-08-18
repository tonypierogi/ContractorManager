import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  deleteEquipment,
  deleteEquipmentTag,
  fetchEquipment,
  fetchEquipmentTags,
  saveEquipment,
  saveEquipmentTag,
  uploadEquipmentImage,
  type SaveEquipmentInput,
  type SaveEquipmentTagInput,
} from './api';

export function useEquipment() {
  return useQuery({
    queryKey: qk.equipment.all,
    queryFn: fetchEquipment,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveEquipmentInput) => saveEquipment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.equipment.all });
    },
  });
}

export function useUploadEquipmentImage() {
  return useMutation({ mutationFn: uploadEquipmentImage });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEquipment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.equipment.all });
    },
  });
}

/** The tags admins have defined, for the filter chips and the tag picker. */
export function useEquipmentTags() {
  return useQuery({
    queryKey: qk.equipment.tags,
    queryFn: fetchEquipmentTags,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveEquipmentTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveEquipmentTagInput) => saveEquipmentTag(input),
    onSuccess: () => {
      // qk.equipment.all is a prefix of qk.equipment.tags, so this refreshes
      // the tag list and the items carrying those tags in one go.
      queryClient.invalidateQueries({ queryKey: qk.equipment.all });
    },
  });
}

export function useDeleteEquipmentTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEquipmentTag,
    onSuccess: () => {
      // Links cascade, so items that carried the tag change too.
      queryClient.invalidateQueries({ queryKey: qk.equipment.all });
    },
  });
}
