import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSaveInventoryItem, useUploadInventoryImage } from '../hooks';
import LocationZonePicker from '@/features/locations/components/LocationZonePicker';
import type { InventoryItem } from '../api';

interface InventoryItemEditorModalProps {
  visible: boolean;
  /** null = add mode */
  item: InventoryItem | null;
  onClose: () => void;
}

export default function InventoryItemEditorModal({
  visible,
  item,
  onClose,
}: InventoryItemEditorModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const saveItem = useSaveInventoryItem();
  const uploadImage = useUploadInventoryImage();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  // Opening always resets fields, then populates from the item when editing
  // (legacy parity, inventory.js:79-112).
  useEffect(() => {
    if (visible) {
      setName(item?.name ?? '');
      setDescription(item?.description ?? '');
      setLocation(item?.location ?? null);
      setImageUrl(item?.image_url ?? null);
      setIsActive(item ? item.is_active !== false : true);
    }
  }, [visible, item]);

  const handlePickImage = async () => {
    if (!user) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets?.length) return;
    try {
      // Upload immediately on selection (legacy parity).
      const asset = picked.assets[0];
      const url = await uploadImage.mutateAsync({
        userId: user.id,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      setImageUrl(url);
    } catch {
      // Error surfaced by the global mutation error toast.
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('Enter item name', 'error');
      return;
    }
    try {
      await saveItem.mutateAsync({
        id: item?.id,
        name: trimmedName,
        description: description.trim() || null,
        location: location || null,
        // Always the editor's current value — Remove + Save clears the image.
        image_url: imageUrl || null,
        is_active: isActive,
        created_by: item ? undefined : user?.id,
      });
      showToast('Item saved');
      onClose();
    } catch {
      // Error surfaced by the global mutation error toast.
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={item ? 'Edit Inventory Item' : 'Add Inventory Item'}
      size="sm"
    >
      <Input
        label="Item Name"
        placeholder="e.g. Paper Towels"
        value={name}
        onChangeText={setName}
      />
      <Input
        label="Description (optional)"
        placeholder="Details about what to look for"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <LocationZonePicker value={location} onChange={setLocation} />

      <Text style={s.sectionLabel}>Image (optional)</Text>
      {imageUrl ? (
        <View style={s.imagePreviewRow}>
          <Image source={{ uri: imageUrl }} style={s.imagePreview} resizeMode="cover" />
          <Button
            title="Remove"
            variant="secondary"
            size="sm"
            onPress={() => setImageUrl(null)}
          />
        </View>
      ) : (
        <View style={s.uploadRow}>
          <Button
            title="Upload Image"
            variant="secondary"
            size="sm"
            onPress={handlePickImage}
            loading={uploadImage.isPending}
          />
        </View>
      )}

      <TouchableOpacity
        style={s.checkboxRow}
        onPress={() => setIsActive((a) => !a)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isActive ? 'checkbox' : 'square-outline'}
          size={22}
          color={isActive ? Colors.accent : Colors.textSecondary}
        />
        <Text style={s.checkboxLabel}>Active (visible to team)</Text>
      </TouchableOpacity>

      <View style={s.footerRow}>
        <Button title="Cancel" variant="secondary" onPress={onClose} />
        <Button title="Save Item" onPress={handleSave} loading={saveItem.isPending} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
    marginBottom: Spacing.md,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    minHeight: 44,
  },
  checkboxLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
});
