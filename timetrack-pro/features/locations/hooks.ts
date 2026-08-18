import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  fetchLinkedTaskLists,
  fetchZoneOverrides,
  saveZoneOverride,
  uploadZonePhoto,
  type LinkedTaskList,
  type SaveZoneOverrideInput,
} from './api';
import {
  setZoneOverrides,
  zonesForFloor,
  type Floor,
  type LocationZone,
  type ZoneOverride,
} from './zones';

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

/**
 * Admin renames and photo swaps for floor-plan rooms. Fetching also publishes
 * them into the zones module cache, so plain helpers like getLocationLabel()
 * pick them up for the rest of the session. Best-effort by design: if the
 * table isn't there yet the query fails quietly and every room keeps its
 * bundled name and photo.
 */
export function useZoneOverrides() {
  return useQuery({
    queryKey: qk.locations.zoneOverrides,
    queryFn: async () => {
      const rows = await fetchZoneOverrides();
      const map: Record<string, ZoneOverride> = {};
      rows.forEach((row) => {
        map[row.zone_id] = { label: row.label, photo_url: row.photo_url };
      });
      setZoneOverrides(map);
      return rows;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

/**
 * Rooms per floor with admin renames applied. Subscribing to the overrides
 * query here is what re-renders callers once the names land.
 */
export function useLocationZones(): {
  floors: Record<Floor, LocationZone[]>;
  isLoading: boolean;
} {
  const { data, isLoading } = useZoneOverrides();

  const floors = useMemo(
    () => ({
      upstairs: zonesForFloor('upstairs'),
      downstairs: zonesForFloor('downstairs'),
    }),
    // Recomputed when the overrides land; `data` is the signal, the labels
    // themselves come from the module cache the query just filled.
    [data],
  );

  return { floors, isLoading };
}

export function useSaveZoneOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveZoneOverrideInput) => saveZoneOverride(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.locations.zoneOverrides });
    },
  });
}

export function useUploadZonePhoto() {
  return useMutation({ mutationFn: uploadZonePhoto });
}
