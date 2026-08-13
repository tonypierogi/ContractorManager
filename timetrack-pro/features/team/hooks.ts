import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import type { Profile } from '@/types/database';
import { deleteTeamMember, fetchTeamMembers } from './api';

// Default to active members only so every picker/filter (schedule,
// timesheets, invoices, assignments) hides deactivated people. The team
// screen itself opts in to see everyone. `!== false` keeps members visible
// until the is_active migration is applied.
export function useTeamMembers(opts?: { includeInactive?: boolean }) {
  const includeInactive = opts?.includeInactive ?? false;
  return useQuery({
    queryKey: qk.team.members,
    queryFn: fetchTeamMembers,
    staleTime: 1000 * 60 * 5,
    select: includeInactive
      ? undefined
      : (members: Profile[]) => members.filter((m) => m.is_active !== false),
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
