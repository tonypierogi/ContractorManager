import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export function useTeamMembers() {
  return useQuery({
    queryKey: ['teamMembers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Profile[];
    },
  });
}

export function useUpdateRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      hourlyRate,
    }: {
      userId: string;
      hourlyRate: number;
    }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ hourly_rate: hourlyRate })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useSearchUsers(email: string) {
  return useQuery({
    queryKey: ['searchUsers', email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', `%${email}%`);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!email && email.length >= 2,
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
    },
  });
}
