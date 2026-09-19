import { supabase } from '@/lib/supabase';
import { uploadImageToMediaBucket, type UploadImageInput } from '@/lib/uploads';
import type {
  FloorLayout,
  FloorLayoutItem,
  FloorPlanMeasurement,
  FurniturePiece,
  FurnitureShape,
  PlanFloor,
} from '@/types/database';

/**
 * "That table isn't there": Postgres' relation-does-not-exist, and PostgREST's
 * code for a table missing from its schema cache. Migrations here are applied
 * by hand, so the app can reach a database that predates
 * 20260919120000_floor_layouts.sql or 20260919150000_floor_plan_lines.sql.
 */
const MISSING_TABLE_CODES = ['42P01', 'PGRST205'];

/** Thrown by the reads below so the Layouts tab can explain the missing setup. */
export class LayoutsNotSetUpError extends Error {
  constructor() {
    super('Floor layouts need a database update before they can be used.');
    this.name = 'LayoutsNotSetUpError';
  }
}

function rethrow(error: { code?: string; message?: string }): never {
  if (error.code && MISSING_TABLE_CODES.includes(error.code)) {
    throw new LayoutsNotSetUpError();
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Measurement lines on the floor plans
// ---------------------------------------------------------------------------

export async function fetchPlanMeasurements(): Promise<FloorPlanMeasurement[]> {
  const { data, error } = await supabase
    .from('floor_plan_measurements')
    .select('*')
    .order('created_at');
  if (error) rethrow(error);
  return (data ?? []) as FloorPlanMeasurement[];
}

export interface SaveMeasurementInput {
  /** Omit to add a line; pass it to edit one. */
  id?: string;
  floor: PlanFloor;
  label: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length_in: number;
}

export async function saveMeasurement(
  input: SaveMeasurementInput,
): Promise<FloorPlanMeasurement> {
  const { id, ...values } = input;
  const row = { ...values, label: values.label?.trim() || null };
  const query = id
    ? supabase.from('floor_plan_measurements').update(row).eq('id', id)
    : supabase.from('floor_plan_measurements').insert(row);
  const { data, error } = await query.select().single();
  if (error) rethrow(error);
  return data as FloorPlanMeasurement;
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { error } = await supabase.from('floor_plan_measurements').delete().eq('id', id);
  if (error) rethrow(error);
}

// ---------------------------------------------------------------------------
// Furniture library
// ---------------------------------------------------------------------------

export async function fetchFurniturePieces(): Promise<FurniturePiece[]> {
  const { data, error } = await supabase
    .from('furniture_pieces')
    .select('*')
    .order('name');
  if (error) rethrow(error);
  return (data ?? []) as FurniturePiece[];
}

export interface SaveFurniturePieceInput {
  /** Omit to add a piece; pass it to edit one. */
  id?: string;
  name: string;
  shape: FurnitureShape;
  width_in: number;
  depth_in: number;
  /** Arm depth for an L; null for other shapes. */
  arm_in: number | null;
  quantity: number | null;
  color: string | null;
  photo_url: string | null;
  notes: string | null;
}

export async function saveFurniturePiece(
  input: SaveFurniturePieceInput,
): Promise<FurniturePiece> {
  const { id, ...values } = input;
  const row = { ...values, name: values.name.trim() };
  const query = id
    ? supabase.from('furniture_pieces').update(row).eq('id', id)
    : supabase.from('furniture_pieces').insert(row);
  const { data, error } = await query.select().single();
  if (error) rethrow(error);
  return data as FurniturePiece;
}

/** Furniture photos live beside the other media uploads, under `furniture/`. */
export function uploadFurniturePhoto(params: UploadImageInput): Promise<string> {
  return uploadImageToMediaBucket('furniture', params);
}

export async function deleteFurniturePiece(id: string): Promise<void> {
  const { error } = await supabase.from('furniture_pieces').delete().eq('id', id);
  if (error) rethrow(error);
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

/**
 * items is JSONB, so it comes back exactly as it was written — but guard the
 * shape anyway: one bad element shouldn't take the whole plan down.
 */
function parseItems(raw: unknown): FloorLayoutItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): FloorLayoutItem[] => {
    if (!entry || typeof entry !== 'object') return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.piece_id !== 'string') return [];
    const x = Number(e.x);
    const y = Number(e.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    const rotation = Number(e.rotation);
    return [
      {
        id: typeof e.id === 'string' ? e.id : `${e.piece_id}-${x}-${y}`,
        piece_id: e.piece_id,
        x,
        y,
        rotation: Number.isFinite(rotation) ? rotation : 0,
        ...(e.flip === true ? { flip: true } : {}),
        label: typeof e.label === 'string' && e.label ? e.label : null,
      },
    ];
  });
}

function toLayout(row: Record<string, unknown>): FloorLayout {
  return { ...(row as unknown as FloorLayout), items: parseItems(row.items) };
}

export async function fetchFloorLayouts(): Promise<FloorLayout[]> {
  const { data, error } = await supabase
    .from('floor_layouts')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) rethrow(error);
  return (data ?? []).map(toLayout);
}

export async function fetchFloorLayout(id: string): Promise<FloorLayout> {
  const { data, error } = await supabase
    .from('floor_layouts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) rethrow(error);
  return toLayout(data);
}

export interface SaveFloorLayoutInput {
  /** Omit to create a layout; pass it to save over one. */
  id?: string;
  name: string;
  floor: PlanFloor;
  zone_id: string | null;
  notes: string | null;
  /** Omit to leave the placed pieces as they are (a settings-only edit). */
  items?: FloorLayoutItem[];
}

export async function saveFloorLayout(input: SaveFloorLayoutInput): Promise<FloorLayout> {
  const { id, ...values } = input;
  const row = { ...values, name: values.name.trim() };
  const query = id
    ? supabase.from('floor_layouts').update(row).eq('id', id)
    : supabase.from('floor_layouts').insert({ items: [], ...row });
  const { data, error } = await query.select().single();
  if (error) rethrow(error);
  return toLayout(data);
}

export async function deleteFloorLayout(id: string): Promise<void> {
  const { error } = await supabase.from('floor_layouts').delete().eq('id', id);
  if (error) rethrow(error);
}
