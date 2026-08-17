import type { StoredEquipmentRef, TaskEquipmentRef } from '@/types/database';

/**
 * Reading and editing the `equipment` JSONB on task_list_items / sop_items.
 *
 * That column holds two shapes in production: bare equipment-id strings from
 * before equipment carried its own pickup/dropoff zones, and TaskEquipmentRef
 * objects since. Everything that touches the column goes through here so the
 * legacy shape is normalized in exactly one place.
 */

/** Normalize a raw `equipment` value from the database into refs. */
export function parseEquipmentRefs(raw: unknown): TaskEquipmentRef[] {
  if (!Array.isArray(raw)) return [];
  const refs: TaskEquipmentRef[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      // Legacy row: an equipment id with no zones of its own.
      if (entry) refs.push({ id: entry, from: null, to: null });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const { id, from, to } = entry as Record<string, unknown>;
      if (typeof id === 'string' && id) {
        refs.push({
          id,
          from: typeof from === 'string' && from ? from : null,
          to: typeof to === 'string' && to ? to : null,
        });
      }
    }
  }
  return refs;
}

/** The equipment ids on a task, for pickers and name lookups. */
export function equipmentIds(refs: readonly TaskEquipmentRef[]): string[] {
  return refs.map((r) => r.id);
}

/** Add the equipment if it isn't tagged yet, otherwise untag it. */
export function toggleEquipmentRef(
  refs: readonly TaskEquipmentRef[],
  equipmentId: string,
): TaskEquipmentRef[] {
  return refs.some((r) => r.id === equipmentId)
    ? refs.filter((r) => r.id !== equipmentId)
    : [...refs, { id: equipmentId, from: null, to: null }];
}

/** Set the pickup or dropoff zone for one tagged piece of equipment. */
export function setEquipmentPlacement(
  refs: readonly TaskEquipmentRef[],
  equipmentId: string,
  field: 'from' | 'to',
  zoneId: string | null,
): TaskEquipmentRef[] {
  return refs.map((r) => (r.id === equipmentId ? { ...r, [field]: zoneId } : r));
}

/** A task's own zones, used as the fallback when equipment sets neither. */
export interface TaskPlacementFallback {
  location_from?: string | null;
  location_to?: string | null;
}

/**
 * Where this equipment actually comes from and goes to. Equipment-level zones
 * win; where they're unset the task's own from/to stands in, so tasks written
 * before this feature keep showing the movement they always did.
 */
export function resolvePlacement(
  ref: TaskEquipmentRef,
  task: TaskPlacementFallback | null | undefined,
): { from: string | null; to: string | null } {
  return {
    from: ref.from ?? task?.location_from ?? null,
    to: ref.to ?? task?.location_to ?? null,
  };
}
