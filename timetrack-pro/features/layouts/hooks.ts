import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { PLAN_FLOORS, fitPlanScale, type PlanScale } from './geometry';
import type { PlanFloor } from '@/types/database';
import {
  deleteFloorLayout,
  deleteFurniturePiece,
  deleteMeasurement,
  fetchFloorLayout,
  fetchFloorLayouts,
  fetchFurniturePieces,
  fetchPlanMeasurements,
  LayoutsNotSetUpError,
  saveFloorLayout,
  saveFurniturePiece,
  saveMeasurement,
  uploadFurniturePhoto,
  type SaveFloorLayoutInput,
  type SaveFurniturePieceInput,
  type SaveMeasurementInput,
} from './api';

/** Don't retry a database that simply hasn't had the migration yet. */
const retryUnlessNotSetUp = (count: number, error: unknown) =>
  !(error instanceof LayoutsNotSetUpError) && count < 2;

/** Measurement lines on the floor plans — where every floor's scale comes from. */
export function usePlanMeasurements() {
  return useQuery({
    queryKey: qk.layouts.measurements,
    queryFn: fetchPlanMeasurements,
    staleTime: 1000 * 60 * 5,
    retry: retryUnlessNotSetUp,
  });
}

/**
 * Each floor's real size, fitted from its saved measurement lines; null for
 * a floor with none. `isLoading` / `error` come from the lines query.
 */
export function usePlanScales() {
  const query = usePlanMeasurements();
  const scales = useMemo(() => {
    const out = {} as Record<PlanFloor, PlanScale | null>;
    PLAN_FLOORS.forEach(({ key }) => {
      out[key] = fitPlanScale(key, (query.data ?? []).filter((l) => l.floor === key));
    });
    return out;
  }, [query.data]);
  return { scales, lines: query.data, isLoading: query.isLoading, error: query.error };
}

export function useSaveMeasurement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMeasurementInput) => saveMeasurement(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.layouts.measurements }),
  });
}

export function useDeleteMeasurement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMeasurement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.layouts.measurements }),
  });
}

export function useFurniturePieces() {
  return useQuery({
    queryKey: qk.layouts.pieces,
    queryFn: fetchFurniturePieces,
    staleTime: 1000 * 60 * 5,
    retry: retryUnlessNotSetUp,
  });
}

export function useFloorLayouts() {
  return useQuery({
    queryKey: qk.layouts.list,
    queryFn: fetchFloorLayouts,
    staleTime: 1000 * 60,
    retry: retryUnlessNotSetUp,
  });
}

export function useFloorLayout(id: string | undefined) {
  return useQuery({
    queryKey: qk.layouts.detail(id ?? ''),
    queryFn: () => fetchFloorLayout(id as string),
    enabled: !!id,
    retry: retryUnlessNotSetUp,
  });
}

export function useSaveFurniturePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveFurniturePieceInput) => saveFurniturePiece(input),
    // A resized piece redraws every layout it's in, so refresh the lot.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.layouts.all }),
  });
}

export function useUploadFurniturePhoto() {
  return useMutation({ mutationFn: uploadFurniturePhoto });
}

export function useDeleteFurniturePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFurniturePiece,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.layouts.all }),
  });
}

export function useSaveFloorLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveFloorLayoutInput) => saveFloorLayout(input),
    onSuccess: (saved) => {
      queryClient.setQueryData(qk.layouts.detail(saved.id), saved);
      queryClient.invalidateQueries({ queryKey: qk.layouts.list });
    },
  });
}

export function useDeleteFloorLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFloorLayout,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: qk.layouts.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.layouts.list });
    },
  });
}
