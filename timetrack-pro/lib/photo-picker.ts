import * as ImagePicker from 'expo-image-picker';

/** Where a photo comes from — every photo field in the app offers both. */
export type PhotoSource = 'camera' | 'library';

interface PickPhotoOptions {
  /** Called when the user refuses camera access, so the caller can toast. */
  onCameraDenied?: () => void;
}

/**
 * Launch the camera or the photo library and return the picked asset, or null
 * when the user cancels (or denies camera access).
 *
 * On web `launchCameraAsync` is a file input with `capture` set: mobile
 * browsers open the camera, desktop ones fall back to a file chooser, and the
 * permission request always resolves granted — so one code path covers every
 * platform.
 */
export async function pickPhotoAsset(
  source: PhotoSource,
  { onCameraDenied }: PickPhotoOptions = {},
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      onCameraDenied?.();
      return null;
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}
