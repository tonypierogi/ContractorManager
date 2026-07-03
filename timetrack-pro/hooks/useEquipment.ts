import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Equipment } from '@/types/database';

export function useEquipment() {
  return useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Equipment[];
    },
  });
}

export function useSaveEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equipment: {
      id?: string;
      name: string;
      location?: string | null;
      image_url?: string | null;
      created_by?: string;
    }) => {
      if (equipment.id) {
        const { id, created_by, ...updates } = equipment;
        const { data, error } = await supabase
          .from('equipment')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as Equipment;
      }

      const { data, error } = await supabase
        .from('equipment')
        .insert(equipment)
        .select()
        .single();
      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
}
