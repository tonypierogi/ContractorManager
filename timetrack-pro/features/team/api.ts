import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export async function fetchTeamMembers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Profile[];
}

export async function deleteTeamMember(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
}
