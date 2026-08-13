import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

/** The app's single public media bucket (legacy parity — everything lives here). */
export const MEDIA_BUCKET = 'sop-media';

const MAX_IMAGE_DIM = 1920;

export interface UploadImageInput {
  userId: string;
  uri: string;
  width?: number;
  height?: number;
}

/**
 * Legacy compressImage parity (utils.js:78-108): fit within 1920x1920,
 * re-encode JPEG q0.8, never upscale. Falls back to the original file when
 * the picker didn't report dimensions or the image already fits.
 */
async function downscaleForUpload(
  uri: string,
  width?: number,
  height?: number,
): Promise<string> {
  if (!width || !height) return uri;
  const ratio = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height, 1);
  if (ratio >= 1) return uri;
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.round(width * ratio) } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

/**
 * Downscale + upload an image into the shared bucket and return its public
 * URL. `subdir` follows the legacy path conventions: '' for SOP/task-list
 * media (`{userId}/{ts}-{name}`), 'inventory' / 'inventory-checks' for the
 * inventory feature.
 */
export async function uploadImageToMediaBucket(
  subdir: '' | 'inventory' | 'inventory-checks',
  { userId, uri, width, height }: UploadImageInput,
): Promise<string> {
  const finalUri = await downscaleForUpload(uri, width, height);
  const rawName = finalUri.split('/').pop() || 'photo.jpg';
  // Legacy filename sanitization (inventory.js:140)
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dir = subdir ? `${userId}/${subdir}` : userId;
  const path = `${dir}/${Date.now()}-${safeName}`;
  const res = await fetch(finalUri);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
