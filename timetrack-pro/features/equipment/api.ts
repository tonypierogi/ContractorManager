import { supabase } from '@/lib/supabase';
import type { Equipment } from '@/types/database';

export type SaveEquipmentInput = {
  id?: string;
  name: string;
  location?: string | null;
  image_url?: string | null;
  created_by?: string;
};

export async function fetchEquipment(): Promise<Equipment[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Equipment[];
}

export async function saveEquipment(equipment: SaveEquipmentInput): Promise<Equipment> {
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
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw error;
}
