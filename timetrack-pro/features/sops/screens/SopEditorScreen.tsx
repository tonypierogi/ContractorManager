import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import MediaRow from '@/components/ui/MediaRow';
import { useToast } from '@/components/ui/Toast';
import {
  EquipmentBox,
  EquipmentPickerModal,
} from '@/features/equipment/components/EquipmentTagging';
import { useAuth } from '@/features/auth/auth-provider';
import { useEquipment } from '@/features/equipment/hooks';
import {
  useSopTemplate,
  useSaveSopTemplate,
  useUploadSopMedia,
} from '@/features/sops/hooks';
import { pickPhotoAsset, type PhotoSource } from '@/lib/photo-picker';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { MediaItem, SopItemType } from '@/types/database';

interface ItemDraft {
  id: string;
  title: string;
  description: string;
  item_type: SopItemType;
  media: MediaItem[];
  equipment: string[];
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
  const [equipmentPickerFor, setEquipmentPickerFor] = useState<string | null>(null);

  const equipmentById = useMemo(
    () => new Map((equipment ?? []).map((eq) => [eq.id, eq.name])),
    [equipment],
  );

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
        equipment: i.equipment ?? [],
      })),
    );
    setHydrated(true);
  }, [id, existing, hydrated]);

  const addItem = (type: SopItemType) => {
    setItems((prev) => [
      ...prev,
      {
        id: makeId(),
        title: '',
        description: '',
        item_type: type,
        media: [],
        equipment: [],
      },
    ]);
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

  const toggleEquipment = (itemId: string, equipmentId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              equipment: i.equipment.includes(equipmentId)
                ? i.equipment.filter((e) => e !== equipmentId)
                : [...i.equipment, equipmentId],
            }
          : i,
      ),
    );
  };

  const equipmentPickerItem = items.find((i) => i.id === equipmentPickerFor) ?? null;

  const updateItem = (itemId: string, field: keyof ItemDraft, value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)),
    );
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
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
          <Card key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View
                style={[
                  styles.typeBadge,
                  item.item_type === 'section' && styles.sectionBadge,
                ]}
              >
                <Text style={styles.typeText}>
                  {item.item_type === 'section' ? 'Section' : 'Task'}
                </Text>
              </View>
              <View style={styles.itemControls}>
                <TouchableOpacity
                  onPress={() => moveItem(index, 'up')}
                  disabled={index === 0}
                  style={styles.arrowBtn}
                >
                  <Text style={[styles.arrow, index === 0 && styles.arrowDisabled]}>
                    ↑
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveItem(index, 'down')}
                  disabled={index === items.length - 1}
                  style={styles.arrowBtn}
                >
                  <Text
                    style={[
                      styles.arrow,
                      index === items.length - 1 && styles.arrowDisabled,
                    ]}
                  >
                    ↓
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Input
              placeholder="Title"
              value={item.title}
              onChangeText={(v) => updateItem(item.id, 'title', v)}
            />
            <Input
              placeholder="Description (optional)"
              value={item.description}
              onChangeText={(v) => updateItem(item.id, 'description', v)}
            />
            {item.item_type === 'task' && (
              <>
                <Text style={styles.fieldLabel}>Images</Text>
                <MediaRow
                  media={item.media}
                  uploading={uploadingItemId === item.id}
                  onAddFromCamera={() => handleAddImage(item.id, 'camera')}
                  onAddFromLibrary={() => handleAddImage(item.id, 'library')}
                  onRemove={(mi) => removeImage(item.id, mi)}
                />
                <Text style={styles.fieldLabel}>Equipment</Text>
                <EquipmentBox
                  labels={item.equipment.map(
                    (eqId) => equipmentById.get(eqId) ?? 'Unknown',
                  )}
                  onPress={() => setEquipmentPickerFor(item.id)}
                />
              </>
            )}
          </Card>
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

      <EquipmentPickerModal
        visible={equipmentPickerFor != null}
        equipment={equipment}
        selectedIds={equipmentPickerItem?.equipment ?? []}
        onToggle={(equipmentId) =>
          equipmentPickerFor && toggleEquipment(equipmentPickerFor, equipmentId)
        }
        onClose={() => setEquipmentPickerFor(null)}
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
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
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
  itemCard: {
    marginBottom: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent + '20',
  },
  sectionBadge: {
    backgroundColor: Colors.warning + '20',
  },
  typeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  arrowBtn: {
    padding: 4,
  },
  arrow: {
    fontSize: FontSize.lg,
    color: Colors.accent,
  },
  arrowDisabled: {
    color: Colors.textMuted,
  },
  removeBtn: {
    fontSize: FontSize.md,
    color: Colors.danger,
    fontWeight: '600',
    padding: 4,
  },
  addButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
