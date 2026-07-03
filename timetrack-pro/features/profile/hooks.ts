import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import type { Profile } from '@/types/database';
import { fetchProfile, updateProfile } from './api';

export function useProfile(userId: string) {
  return useQuery({
    queryKey: qk.profiles.detail(userId),
    queryFn: () => fetchProfile(userId),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: Partial<Profile> }) =>
      updateProfile(userId, updates),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.profiles.detail(variables.userId) });
      // profile fields (name, rate) also surface in the team list
      queryClient.invalidateQueries({ queryKey: qk.team.all });
    },
  });
}
