import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { deleteTeamMember, fetchTeamMembers } from './api';

export function useTeamMembers() {
  return useQuery({
    queryKey: qk.team.members,
    queryFn: fetchTeamMembers,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.team.all });
    },
  });
}
