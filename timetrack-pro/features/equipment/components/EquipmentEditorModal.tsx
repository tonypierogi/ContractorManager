import { useEffect, useState } from 'react';
import { View, Text, Image, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/features/auth/auth-provider';
import LocationZonePicker from '@/features/locations/components/LocationZonePicker';
import {
  useSaveEquipment,
  useDeleteEquipment,
  useUploadEquipmentImage,
} from '@/features/equipment/hooks';
import { pickPhotoAsset, type PhotoSource } from '@/lib/photo-picker';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { Equipment } from '@/types/database';

interface Props {
  visible: boolean;
  /** null = add a new item; otherwise edit this one. */
  item: Equipment | null;
  onClose: () => void;
}

/**
 * Add/edit form for an equipment item: name, zone, photo.
 * Extracted from the old standalone Equipment screen so the
 * Locations & Equipment tab can edit in place.
 */
export default function EquipmentEditorModal({ visible, item, onClose }: Props) {
  const { user } = useAuth();
  const saveEquipment = useSaveEquipment();
  const deleteEquipment = useDeleteEquipment();
  const uploadImage = useUploadEquipmentImage();

  const [name, setName] = useState('');
  const [location, setLocation] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Re-seed the form each time the modal opens.
  useEffect(() => {
    if (visible) {
      setName(item?.name ?? '');
      setLocation(item?.location ?? null);
      setImageUrl(item?.image_url ?? null);
    }
  }, [visible, item]);

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
      // Upload immediately on selection (same flow as the inventory editor).
      const url = await uploadImage.mutateAsync({
        userId: user.id,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      setImageUrl(url);
    } catch {
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await saveEquipment.mutateAsync({
        id: item?.id,
        name,
        location: location || null,
        // Always the editor's current value — Remove + Save clears the image.
        image_url: imageUrl || null,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save equipment');
    }
  };

  const handleDelete = () => {
    if (!item) return;
    Alert.alert('Delete Equipment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEquipment.mutate(item.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={item ? 'Edit Equipment' : 'Add Equipment'}
    >
      <Input
        label="Name"
        placeholder="e.g. Pressure Washer"
        value={name}
        onChangeText={setName}
      />
      <LocationZonePicker value={location} onChange={setLocation} />

      <Text style={styles.sectionLabel}>Photo</Text>
      {imageUrl ? (
        <View style={styles.imagePreviewRow}>
          <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
          <View style={styles.imageActions}>
            <View style={styles.imageActionsRow}>
              <Button
                title="Retake"
                variant="secondary"
                size="sm"
                icon={<Ionicons name="camera-outline" size={16} color={Colors.text} />}
                onPress={() => handleAddPhoto('camera')}
                loading={uploadImage.isPending}
              />
              <Button
                title="Upload"
                variant="secondary"
                size="sm"
                icon={<Ionicons name="image-outline" size={16} color={Colors.text} />}
                onPress={() => handleAddPhoto('library')}
                loading={uploadImage.isPending}
              />
            </View>
            <Button
              title="Remove"
              variant="danger"
              size="sm"
              onPress={() => setImageUrl(null)}
            />
          </View>
        </View>
      ) : (
        <View style={styles.uploadRow}>
          <Button
            title="Take Photo"
            size="sm"
            icon={<Ionicons name="camera" size={16} color={Colors.bgPrimary} />}
            onPress={() => handleAddPhoto('camera')}
            loading={uploadImage.isPending}
          />
          <Button
            title="Upload Photo"
            variant="secondary"
            size="sm"
            icon={<Ionicons name="image-outline" size={16} color={Colors.text} />}
            onPress={() => handleAddPhoto('library')}
            loading={uploadImage.isPending}
          />
        </View>
      )}

      <Button
        title="Save"
        onPress={handleSave}
        loading={saveEquipment.isPending}
        fullWidth
      />
      {item && (
        <View style={styles.deleteRow}>
          <Button
            title="Delete Equipment"
            variant="danger"
            size="sm"
            onPress={handleDelete}
            loading={deleteEquipment.isPending}
            fullWidth
          />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  uploadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  imageActions: {
    flex: 1,
    gap: Spacing.sm,
  },
  imageActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  imagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  imagePreview: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deleteRow: {
    marginTop: Spacing.sm,
  },
});
