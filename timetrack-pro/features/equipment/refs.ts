import { formatZoneSpan, getLocationLabel } from '@/features/locations/zones';
import type {
  Equipment,
  EquipmentLinkMode,
  MediaItem,
  TaskEquipmentRef,
} from '@/types/database';

/**
 * Reading and editing the `equipment` JSONB on task_list_items / sop_items.
 *
 * That column holds three shapes in production: bare equipment-id strings from
 * before equipment carried its own pickup/dropoff zones, {id, from, to}
 * objects from before link modes, and full TaskEquipmentRef objects since.
 * Everything that touches the column goes through here so the older shapes are
 * normalized in exactly one place.
 */

export const EQUIPMENT_LINK_MODES: EquipmentLinkMode[] = ['use', 'return'];

/**
 * Short badge text, e.g. on a checklist row. The stored values stay 'use' and
 * 'return' (they are written into the equipment JSONB on every task ever
 * saved); only what people read says Get / Bring.
 */
export const EQUIPMENT_MODE_LABEL: Record<EquipmentLinkMode, string> = {
  use: 'Get',
  return: 'Bring',
};

/** Field label in the editors, e.g. "Equipment to get". */
export const EQUIPMENT_MODE_FIELD_LABEL: Record<EquipmentLinkMode, string> = {
  use: 'Equipment to get',
  return: 'Equipment to bring',
};

/** Full sentence for pickers and the detail sheet. */
export const EQUIPMENT_MODE_DESCRIPTION: Record<EquipmentLinkMode, string> = {
  use: 'Go get it — it starts somewhere else',
  return: 'Bring it back where it belongs',
};

/** Zone-picker labels: what "from" and "to" mean for each mode. */
export const EQUIPMENT_ZONE_LABEL: Record<
  EquipmentLinkMode,
  { from: string; to: string }
> = {
  use: { from: 'Get it from', to: 'Use it in' },
  return: { from: 'Pick it up from', to: 'Bring it to' },
};

/**
 * equipment id -> the room it lives in, from the Equipment screen. Tagging a
 * piece of equipment on a task fills that room in for you, so nobody retypes
 * what the equipment record already knows.
 */
export type EquipmentHomeZones = ReadonlyMap<string, string | null>;

export function equipmentHomeZones(
  equipment: readonly Equipment[] | undefined,
): Map<string, string | null> {
  return new Map((equipment ?? []).map((eq) => [eq.id, eq.location ?? null]));
}

/**
 * equipment id -> its photo from the Equipment screen. Tagging equipment on a
 * task copies that photo onto the task, so the crew sees the thing they are
 * being sent for without anyone re-shooting it.
 */
export type EquipmentImages = ReadonlyMap<string, string | null>;

export function equipmentImages(
  equipment: readonly Equipment[] | undefined,
): Map<string, string | null> {
  return new Map((equipment ?? []).map((eq) => [eq.id, eq.image_url ?? null]));
}

/**
 * Keep a task's photos in step with an equipment change: newly tagged gear
 * brings its photo in, untagged gear takes its photo back out. Only photos
 * this added are touched — anything shot for the task itself, and any
 * equipment photo the admin deleted by hand, is left where it is.
 */
export function syncEquipmentMedia(
  media: readonly MediaItem[],
  prevRefs: readonly TaskEquipmentRef[],
  nextRefs: readonly TaskEquipmentRef[],
  images: EquipmentImages,
): MediaItem[] {
  const before = new Set(prevRefs.map((r) => r.id));
  const after = new Set(nextRefs.map((r) => r.id));

  const kept = media.filter((m) => !m.equipment_id || after.has(m.equipment_id));
  const urls = new Set(kept.map((m) => m.url));
  const added: MediaItem[] = [];
  for (const ref of nextRefs) {
    if (before.has(ref.id)) continue;
    const url = images.get(ref.id);
    if (!url || urls.has(url)) continue;
    urls.add(url);
    added.push({ url, type: 'image', equipment_id: ref.id });
  }

  if (!added.length && kept.length === media.length) return media as MediaItem[];
  return [...kept, ...added];
}

/**
 * Which zone the equipment's home fills in: you go GET it where it lives, and
 * you BRING it back to where it lives. The other side stays the task's job.
 */
export function homeZoneField(mode: EquipmentLinkMode): 'from' | 'to' {
  return mode === 'return' ? 'to' : 'from';
}

/** The refs linked in one mode, for the editors' two equipment fields. */
export function refsForMode(
  refs: readonly TaskEquipmentRef[],
  mode: EquipmentLinkMode,
): TaskEquipmentRef[] {
  return refs.filter((r) => r.mode === mode);
}

/** Drop one piece of equipment from a task entirely. */
export function removeEquipmentRef(
  refs: readonly TaskEquipmentRef[],
  equipmentId: string,
): TaskEquipmentRef[] {
  return refs.filter((r) => r.id !== equipmentId);
}

function parseMode(
  raw: unknown,
  from: string | null,
  to: string | null,
): EquipmentLinkMode {
  if (raw === 'use' || raw === 'return') return raw;
  // Pre-mode row: a lone dropoff zone reads as a return, everything else as a
  // fetch-and-use, which is what those rows meant before modes existed.
  return to && !from ? 'return' : 'use';
}

/** Normalize a raw `equipment` value from the database into refs. */
export function parseEquipmentRefs(raw: unknown): TaskEquipmentRef[] {
  if (!Array.isArray(raw)) return [];
  const refs: TaskEquipmentRef[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      // Legacy row: an equipment id with no zones or mode of its own.
      if (entry) refs.push({ id: entry, mode: 'use', from: null, to: null });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const { id, mode, from, to } = entry as Record<string, unknown>;
      if (typeof id === 'string' && id) {
        const fromZone = typeof from === 'string' && from ? from : null;
        const toZone = typeof to === 'string' && to ? to : null;
        refs.push({
          id,
          mode: parseMode(mode, fromZone, toZone),
          from: fromZone,
          to: toZone,
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

/** The link mode per equipment id, for pickers. */
export function equipmentModes(
  refs: readonly TaskEquipmentRef[],
): Map<string, EquipmentLinkMode> {
  return new Map(refs.map((r) => [r.id, r.mode]));
}

/**
 * Link the equipment in this mode; re-picking the mode it already has unlinks
 * it, and picking the other mode switches it over (one link per piece of
 * equipment per task).
 */
export function toggleEquipmentRef(
  refs: readonly TaskEquipmentRef[],
  equipmentId: string,
  mode: EquipmentLinkMode = 'use',
  homeZone: string | null = null,
): TaskEquipmentRef[] {
  const existing = refs.find((r) => r.id === equipmentId);
  if (!existing) {
    const ref: TaskEquipmentRef = { id: equipmentId, mode, from: null, to: null };
    if (homeZone) ref[homeZoneField(mode)] = homeZone;
    return [...refs, ref];
  }
  if (existing.mode === mode) return refs.filter((r) => r.id !== equipmentId);
  return setEquipmentMode(refs, equipmentId, mode, homeZone);
}

/**
 * Switch an already-linked piece of equipment between use and return. The home
 * room follows the switch: it moves to whichever side now means "where it
 * lives", and a room the admin picked themselves is left alone.
 */
export function setEquipmentMode(
  refs: readonly TaskEquipmentRef[],
  equipmentId: string,
  mode: EquipmentLinkMode,
  homeZone: string | null = null,
): TaskEquipmentRef[] {
  return refs.map((r) => {
    if (r.id !== equipmentId) return r;
    const next: TaskEquipmentRef = { ...r, mode };
    if (homeZone) {
      const field = homeZoneField(mode);
      const other = field === 'from' ? 'to' : 'from';
      if (next[other] === homeZone) next[other] = null;
      if (!next[field]) next[field] = homeZone;
    }
    return next;
  });
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
 * Where this equipment actually comes from and goes to. Zones set on the ref
 * win; next comes the equipment's own home room on the side that means "where
 * it lives" (so rows saved before the home auto-fill still read right); the
 * task's own from/to stands in last.
 */
export function resolvePlacement(
  ref: TaskEquipmentRef,
  task: TaskPlacementFallback | null | undefined,
  homeZone: string | null = null,
): { from: string | null; to: string | null } {
  const home = homeZoneField(ref.mode);
  return {
    from: ref.from ?? (home === 'from' ? homeZone : null) ?? task?.location_from ?? null,
    to: ref.to ?? (home === 'to' ? homeZone : null) ?? task?.location_to ?? null,
  };
}

/**
 * One line of "where does this go?", written from the link's point of view:
 * a return names its destination, a use names where to grab it.
 */
export function placementSummary(
  ref: TaskEquipmentRef,
  task: TaskPlacementFallback | null | undefined,
  homeZone: string | null = null,
): string | null {
  const { from, to } = resolvePlacement(ref, task, homeZone);
  if (ref.mode === 'return') {
    if (to) return `Back to ${getLocationLabel(to)}`;
    return from ? `From ${getLocationLabel(from)}` : null;
  }
  return formatZoneSpan(from, to);
}
