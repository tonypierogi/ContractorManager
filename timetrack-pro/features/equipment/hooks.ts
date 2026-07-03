import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  deleteEquipment,
  fetchEquipment,
  saveEquipment,
  type SaveEquipmentInput,
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

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEquipment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.equipment.all });
    },
  });
}
