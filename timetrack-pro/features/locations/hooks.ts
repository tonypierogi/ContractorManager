import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { fetchLinkedTaskLists, type LinkedTaskList } from './api';

export type { LinkedTaskList };

/**
 * Task lists linked to the active floor-plan zone.
 * Only runs while a zone is active (zoneId non-null).
 */
export function useLinkedTaskLists(zoneId: string | null) {
  return useQuery({
    queryKey: qk.locations.linkedTasks(zoneId ?? ''),
    queryFn: () => fetchLinkedTaskLists(zoneId as string),
    enabled: !!zoneId,
  });
}
