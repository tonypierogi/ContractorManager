import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import SopItemCard from '@/features/sops/components/SopItemCard';
import SopItemEditorSheet from '@/features/sops/components/SopItemEditorSheet';
import {
  equipmentHomeZones,
  equipmentImages,
  parseEquipmentRefs,
  removeEquipmentRef,
  setEquipmentMode,
  setEquipmentPlacement,
  syncEquipmentMedia,
  toggleEquipmentRef,
} from '@/features/equipment/refs';
import { useAuth } from '@/features/auth/auth-provider';
import { useEquipment } from '@/features/equipment/hooks';
import {
  useSopTemplate,
  useSaveSopTemplate,
  useUploadSopMedia,
} from '@/features/sops/hooks';
import { pickPhotoAsset, type PhotoSource } from '@/lib/photo-picker';
import { Colors, Spacing, FontSize } from '@/constants/theme';
import type { MediaItem, SopItemType, TaskEquipmentRef } from '@/types/database';

interface ItemDraft {
  id: string;
  title: string;
  description: string;
  item_type: SopItemType;
  media: MediaItem[];
  equipment: TaskEquipmentRef[];
}

let nextItemId = 0;
const makeId = () => `draft-${++nextItemId}`;

export default function SopEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: existing } = useSopTemplate(id ?? '');
  const saveSop = useSaveSopTemplate();
  const uploadMedia = useUploadSopMedia();
  const { data: equipment } = useEquipment();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  // Which item is open in the editing sheet; the list itself stays collapsed.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const equipmentById = useMemo(
    () => new Map((equipment ?? []).map((eq) => [eq.id, eq.name])),
    [equipment],
  );
  // Where each piece of equipment lives, so tagging it on a task fills the
  // room in instead of asking for it again.
  const equipmentHomes = useMemo(() => equipmentHomeZones(equipment), [equipment]);
  // ...and what it looks like, so tagging it also shows the crew the thing.
  const equipmentPhotos = useMemo(() => equipmentImages(equipment), [equipment]);

  // One-shot hydration: a focus refetch must not clobber in-progress edits,
  // and item media/equipment must round-trip so editing never strips them.
  useEffect(() => {
    if (!id || !existing || hydrated) return;
    setName(existing.template.name);
    setDescription(existing.template.description ?? '');
    setItems(
      existing.items.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description ?? '',
        item_type: i.item_type,
        media: i.media ?? [],
        // Older SOP rows stored bare equipment ids (and some, plain names) —
        // parse normalizes every shape to refs carrying a get/bring mode.
        equipment: parseEquipmentRefs(i.equipment),
      })),
    );
    setHydrated(true);
  }, [id, existing, hydrated]);

  // A brand new item opens straight into the sheet — there is nothing to see
  // on its collapsed row yet.
  const addItem = (type: SopItemType) => {
    const draft: ItemDraft = {
      id: makeId(),
      title: '',
      description: '',
      item_type: type,
      media: [],
      equipment: [],
    };
    setItems((prev) => [...prev, draft]);
    setEditingItemId(draft.id);
  };

  // Upload immediately on selection (legacy parity); removing an image only
  // clears it from the draft — uploaded files are never deleted.
  const handleAddImage = async (itemId: string, source: PhotoSource) => {
    if (!user) return;
    const asset = await pickPhotoAsset(source, {
      onCameraDenied: () =>
        showToast('Camera access denied — upload from your library instead', 'error'),
    });
    if (!asset) return;
    setUploadingItemId(itemId);
    try {
      const url = await uploadMedia.mutateAsync({
        userId: user.id,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, media: [...i.media, { url, type: 'image' }] } : i,
        ),
      );
    } catch {
      // surfaced by the global mutation error toast
    } finally {
      setUploadingItemId(null);
    }
  };

  const removeImage = (itemId: string, mediaIndex: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, media: i.media.filter((_, mi) => mi !== mediaIndex) }
          : i,
      ),
    );
  };

  // Every equipment change goes through here so the item's photos follow the
  // gear: tagging something copies its picture in, untagging takes it out.
  const patchEquipment = (
    itemId: string,
    update: (refs: TaskEquipmentRef[]) => TaskEquipmentRef[],
  ) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const equipmentRefs = update(i.equipment);
        return {
          ...i,
          equipment: equipmentRefs,
          media: syncEquipmentMedia(i.media, i.equipment, equipmentRefs, equipmentPhotos),
        };
      }),
    );
  };

  const editingItem = items.find((i) => i.id === editingItemId) ?? null;
  const editingIndex = items.findIndex((i) => i.id === editingItemId);

  const updateItem = (itemId: string, field: keyof ItemDraft, value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)),
    );
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setEditingItemId((current) => (current === itemId ? null : current));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setItems((prev) => {
      const arr = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'SOP name is required');
      return;
    }
    try {
      await saveSop.mutateAsync({
        id: id || undefined,
        name,
        description,
        items: items.map((i, idx) => ({
          title: i.title,
          description: i.description,
          item_type: i.item_type,
          media: i.media,
          equipment: i.equipment,
          sort_order: idx,
        })),
      });
      router.back();
    } catch {
      // surfaced by the global mutation error toast
    }
  };

  if (id && !hydrated) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.topBar}>
        <Button title="← Back" onPress={() => router.back()} variant="ghost" size="sm" />
        <Button
          title="Save SOP"
          onPress={handleSave}
          loading={saveSop.isPending}
          size="sm"
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{id ? 'Edit SOP' : 'New SOP'}</Text>

        <Input
          label="Template Name"
          placeholder="e.g. Opening Checklist"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Description"
          placeholder="Brief description"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.subheading}>Items</Text>

        {items.map((item, index) => (
          <SopItemCard
            key={item.id}
            item={item}
            index={index}
            count={items.length}
            onOpen={() => setEditingItemId(item.id)}
            onMove={(direction) => moveItem(index, direction)}
            onRemove={() => removeItem(item.id)}
          />
        ))}

        <View style={styles.addButtons}>
          <Button
            title="Add Task"
            onPress={() => addItem('task')}
            variant="secondary"
            size="sm"
          />
          <Button
            title="Add Section"
            onPress={() => addItem('section')}
            variant="secondary"
            size="sm"
          />
        </View>

      </ScrollView>

      <SopItemEditorSheet
        item={editingItem}
        index={editingIndex}
        equipment={equipment}
        equipmentById={equipmentById}
        equipmentHomes={equipmentHomes}
        uploading={!!editingItem && uploadingItemId === editingItem.id}
        onUpdateField={(field, value) =>
          editingItem && updateItem(editingItem.id, field, value)
        }
        onSetEquipmentPlacement={(equipmentId, field, zoneId) =>
          editingItem &&
          patchEquipment(editingItem.id, (refs) =>
            setEquipmentPlacement(refs, equipmentId, field, zoneId),
          )
        }
        onSetEquipmentMode={(equipmentId, mode) =>
          editingItem &&
          patchEquipment(editingItem.id, (refs) =>
            setEquipmentMode(
              refs,
              equipmentId,
              mode,
              equipmentHomes.get(equipmentId) ?? null,
            ),
          )
        }
        onToggleEquipment={(equipmentId, mode) =>
          editingItem &&
          patchEquipment(editingItem.id, (refs) =>
            toggleEquipmentRef(
              refs,
              equipmentId,
              mode,
              equipmentHomes.get(equipmentId) ?? null,
            ),
          )
        }
        onRemoveEquipment={(equipmentId) =>
          editingItem &&
          patchEquipment(editingItem.id, (refs) => removeEquipmentRef(refs, equipmentId))
        }
        onAddImage={(source) => editingItem && handleAddImage(editingItem.id, source)}
        onRemoveImage={(mi) => editingItem && removeImage(editingItem.id, mi)}
        onClose={() => setEditingItemId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  content: {
    padding: Spacing.md,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginVertical: Spacing.md,
  },
  subheading: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
