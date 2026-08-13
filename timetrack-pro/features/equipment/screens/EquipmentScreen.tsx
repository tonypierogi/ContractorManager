import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/features/auth/auth-provider';
import LocationZonePicker from '@/features/locations/components/LocationZonePicker';
import { getLocationLabel } from '@/features/locations/zones';
import {
  useEquipment,
  useSaveEquipment,
  useDeleteEquipment,
  useUploadEquipmentImage,
} from '@/features/equipment/hooks';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import type { Equipment } from '@/types/database';

export default function EquipmentScreen() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { data: equipment, isLoading, refetch } = useEquipment();
  const saveEquipment = useSaveEquipment();
  const deleteEquipment = useDeleteEquipment();
  const uploadImage = useUploadEquipmentImage();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const numColumns = width >= 900 ? 3 : width >= 600 ? 2 : 1;

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setLocation(null);
    setImageUrl(null);
    setShowModal(true);
  };

  const openEdit = (item: Equipment) => {
    setEditingId(item.id);
    setName(item.name);
    setLocation(item.location ?? null);
    setImageUrl(item.image_url ?? null);
    setShowModal(true);
  };

  const handlePickImage = async () => {
    if (!user) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets?.length) return;
    try {
      // Upload immediately on selection (same flow as the inventory editor).
      const asset = picked.assets[0];
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
        id: editingId ?? undefined,
        name,
        location: location || null,
        // Always the editor's current value — Remove + Save clears the image.
        image_url: imageUrl || null,
      });
      setShowModal(false);
    } catch {
      Alert.alert('Error', 'Failed to save equipment');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Equipment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteEquipment.mutate(id),
      },
    ]);
  };

  const renderItem = useCallback(
    ({ item }: { item: Equipment }) => (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.imageArea}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.placeholderEmoji}>⚙️</Text>
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.location ? (
              <Text style={styles.cardLocation} numberOfLines={1}>
                {getLocationLabel(item.location)}
              </Text>
            ) : null}
            <View style={styles.actionsRow}>
              <Button
                title="Edit"
                onPress={() => openEdit(item)}
                variant="secondary"
                size="sm"
              />
              <Button
                title="Delete"
                onPress={() => handleDelete(item.id)}
                variant="danger"
                size="sm"
              />
            </View>
          </View>
        </View>
      </View>
    ),
    [deleteEquipment],
  );

  const listData = useMemo(() => equipment ?? [], [equipment]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Equipment</Text>
        <Button title="+ Add Equipment" onPress={openAdd} size="sm" />
      </View>

      <FlatList
        key={numColumns}
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.list}
        refreshing={isLoading}
        onRefresh={refetch}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⚙️</Text>
              <Text style={styles.emptyTitle}>No equipment yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your first piece of equipment
              </Text>
              <View style={styles.emptyAction}>
                <Button title="Add Equipment" onPress={openAdd} />
              </View>
            </View>
          ) : null
        }
      />

      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Equipment' : 'Add Equipment'}
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
            <Button
              title="Remove"
              variant="danger"
              size="sm"
              onPress={() => setImageUrl(null)}
            />
          </View>
        ) : (
          <View style={styles.uploadRow}>
            <Button
              title="Upload Image"
              variant="secondary"
              size="sm"
              onPress={handlePickImage}
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
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  list: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  row: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageArea: {
    width: 80,
    height: 80,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 80,
    height: 80,
  },
  placeholderEmoji: {
    fontSize: 28,
  },
  cardInfo: {
    flex: 1,
    padding: Spacing.md,
  },
  cardName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  cardLocation: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  emptyAction: {
    marginTop: Spacing.sm,
  },
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
});
