import { useEffect, useState } from 'react';
import { View, Text, Image, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet from '@/components/ui/Sheet';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuth } from '@/features/auth/auth-provider';
import { useSaveZoneOverride, useUploadZonePhoto } from '@/features/locations/hooks';
import {
  ALL_ZONES,
  getZoneOverride,
  getZonePhoto,
} from '@/features/locations/zones';
import { pickPhotoAsset, type PhotoSource } from '@/lib/photo-picker';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface Props {
  /** Zone id being edited; null closes the sheet. */
  zoneId: string | null;
  onClose: () => void;
}

/**
 * Admin editor for one floor-plan room: what it's called, and the photo crews
 * see when they're sent there. Only the name and photo are editable — the zone
 * id stays fixed because task lists, equipment and inventory all store it
 * verbatim, and the room's outline is part of the bundled floor-plan image.
 *
 * Clearing a field restores the bundled default rather than blanking it.
 */
export default function RoomEditorSheet({ zoneId, onClose }: Props) {
  const { user } = useAuth();
  const saveOverride = useSaveZoneOverride();
  const uploadPhoto = useUploadZonePhoto();

  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const bundledName = zoneId
    ? ALL_ZONES.find((z) => z.id === zoneId)?.label ?? zoneId
    : '';

  // Re-seed each time the sheet opens on a room.
  useEffect(() => {
    if (!zoneId) return;
    const override = getZoneOverride(zoneId);
    setName(override?.label ?? '');
    setPhotoUrl(override?.photo_url ?? null);
  }, [zoneId]);

  const preview = photoUrl ? { uri: photoUrl } : getZonePhoto(zoneId);
  const usingBundledPhoto = !photoUrl && !!preview;

  const handleAddPhoto = async (source: PhotoSource) => {
    if (!user) return;
    const asset = await pickPhotoAsset(source, {
      onCameraDenied: () =>
        Alert.alert(
          'Camera unavailable',
          'Camera access denied — upload from your library instead.',
        ),
    });
    if (!asset) return;
    try {
      const url = await uploadPhoto.mutateAsync({
        userId: user.id,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      setPhotoUrl(url);
    } catch {
      Alert.alert('Error', 'Failed to upload photo');
    }
  };

  const handleSave = async () => {
    if (!zoneId) return;
    try {
      await saveOverride.mutateAsync({
        zoneId,
        // Blank means "go back to the bundled name", not an empty room name.
        label: name.trim() || null,
        photoUrl,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save this room');
    }
  };

  return (
    <Sheet
      visible={zoneId != null}
      onClose={onClose}
      title="Edit room"
      subtitle={`Shown everywhere this room is named — originally “${bundledName}”`}
    >
      <Input
        label="Room name"
        placeholder={bundledName}
        value={name}
        onChangeText={setName}
      />
      <Text style={s.hint}>Leave blank to use “{bundledName}”.</Text>

      <Text style={s.sectionLabel}>Photo</Text>
      {preview ? (
        <Image source={preview} style={s.preview} resizeMode="cover" />
      ) : (
        <View style={[s.preview, s.previewEmpty]}>
          <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
          <Text style={s.hint}>No photo for this room yet</Text>
        </View>
      )}
      {usingBundledPhoto ? (
        <Text style={s.hint}>Currently the bundled photo.</Text>
      ) : null}

      <View style={s.photoActions}>
        <Button
          title="Take Photo"
          size="sm"
          icon={<Ionicons name="camera" size={16} color={Colors.bgPrimary} />}
          onPress={() => handleAddPhoto('camera')}
          loading={uploadPhoto.isPending}
        />
        <Button
          title="Upload Photo"
          variant="secondary"
          size="sm"
          icon={<Ionicons name="image-outline" size={16} color={Colors.text} />}
          onPress={() => handleAddPhoto('library')}
          loading={uploadPhoto.isPending}
        />
        {photoUrl ? (
          <Button
            title="Use default"
            variant="danger"
            size="sm"
            onPress={() => setPhotoUrl(null)}
          />
        ) : null}
      </View>

      <Button
        title="Save room"
        onPress={handleSave}
        loading={saveOverride.isPending}
        fullWidth
      />
    </Sheet>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  // Fixed height rather than an aspect ratio: room shots vary wildly in shape,
  // and react-native-web ignores aspectRatio on Image.
  preview: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    marginBottom: Spacing.sm,
  },
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
});
