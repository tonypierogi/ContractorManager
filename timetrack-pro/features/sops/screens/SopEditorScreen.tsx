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
import DraggableList from '@/components/ui/DraggableList';
import SectionPickerModal from '@/components/ui/SectionPickerModal';
import ExistingItemPickerModal from '@/features/task-lists/components/ExistingItemPickerModal';
import ImportTasksModal from '@/features/task-lists/components/ImportTasksModal';
import type { TemplateItemRef } from '@/features/task-lists/api';
import type { ParsedImportItem } from '@/features/task-lists/import-text';
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
  // Which item is being sent to a section (set by holding its drag grip).
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  // Scrolling is switched off mid-drag so the page holds still under the row.
  const [reordering, setReordering] = useState(false);
  const [existingPickerOpen, setExistingPickerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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
    setItems((prev) => [draft, ...prev]);
    setEditingItemId(draft.id);
  };

  // Pasted notes become plain drafts: photos and gear are added after, in the
  // same editor as everything else.
  const importItems = (parsed: ParsedImportItem[]) => {
    setItems((prev) => [
      ...parsed.map((it) => ({
        id: makeId(),
        title: it.title,
        description: it.description,
        item_type: it.item_type as SopItemType,
        media: [],
        equipment: [],
      })),
      ...prev,
    ]);
    setImportOpen(false);
    showToast(
      `Added ${parsed.length} item${parsed.length === 1 ? '' : 's'} from notes`,
    );
  };

  // Copy a step from another SOP or task list into this draft. Media URLs are
  // shared rather than re-uploaded; task-list-only fields are dropped.
  const addFromExisting = (tpl: TemplateItemRef) => {
    const equipmentRefs = tpl.equipment.map((ref) => ({ ...ref }));
    setItems((prev) => [
      {
        id: makeId(),
        title: tpl.title,
        description: tpl.description ?? '',
        item_type: (tpl.item_type ?? 'task') as SopItemType,
        // Copied steps pick up any equipment photo the original predates.
        media: syncEquipmentMedia([...tpl.media], [], equipmentRefs, equipmentPhotos),
        equipment: equipmentRefs,
      },
      ...prev,
    ]);
    setExistingPickerOpen(false);
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

  /** Drag-to-reorder: pull one row out and drop it at its new index. */
  const reorderItems = (from: number, to: number) => {
    setItems((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  /**
   * A section travels with the steps under it: holding its grip picks up the
   * whole run, down to the next section or the end of the list.
   */
  const blockSizeAt = (index: number) => {
    if (items[index]?.item_type !== 'section') return 1;
    let n = 1;
    while (index + n < items.length && items[index + n].item_type !== 'section') n += 1;
    return n;
  };

  /** Drop `count` rows starting at `from` back in at `to` (post-removal index). */
  const moveBlock = (from: number, count: number, to: number) => {
    setItems((prev) => {
      if (from < 0 || count <= 0 || from + count > prev.length) return prev;
      const arr = [...prev];
      const moved = arr.splice(from, count);
      arr.splice(Math.max(0, Math.min(to, arr.length)), 0, ...moved);
      return arr;
    });
  };

  const sections = useMemo(() => {
    const found: { id: string; title: string; taskCount: number }[] = [];
    items.forEach((it) => {
      if (it.item_type === 'section') {
        found.push({
          id: it.id,
          title: it.title.trim() || 'Untitled section',
          taskCount: 0,
        });
      } else if (found.length > 0) {
        found[found.length - 1].taskCount += 1;
      }
    });
    return found;
  }, [items]);

  const movingItem = items.find((i) => i.id === movingItemId) ?? null;

  // Sections aren't steps, so they don't take a number — the tasks around
  // them keep counting as the crew will read them.
  const itemNumbers = useMemo(() => {
    let n = 0;
    return items.map((i) => (i.item_type === 'section' ? null : ++n));
  }, [items]);

  /** Drop the held task at the end of the chosen section (null = top). */
  const moveToSection = (sectionId: string | null) => {
    const itemId = movingItemId;
    setMovingItemId(null);
    if (!itemId) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === itemId);
      if (from < 0) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      if (sectionId === null) {
        arr.unshift(moved);
        return arr;
      }
      const sectionIndex = arr.findIndex((i) => i.id === sectionId);
      if (sectionIndex < 0) return prev;
      let insertAt = sectionIndex + 1;
      while (insertAt < arr.length && arr[insertAt].item_type !== 'section') {
        insertAt += 1;
      }
      arr.splice(insertAt, 0, moved);
      return arr;
    });
    const label = sectionId
      ? (sections.find((s) => s.id === sectionId)?.title ?? 'section')
      : 'the top of the list';
    showToast(`Moved to ${label}`);
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
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!reordering}>
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
        {/* Adding sits above the list: on a fifty-step SOP the buttons stay
            where you left off instead of a scroll away at the bottom. */}
        <View style={styles.addRow}>
          <View style={styles.addRowBtn}>
            <Button
              title="New Task"
              onPress={() => addItem('task')}
              variant="secondary"
              size="sm"
              fullWidth
            />
          </View>
          <View style={styles.addRowBtn}>
            <Button
              title="New Section"
              onPress={() => addItem('section')}
              variant="secondary"
              size="sm"
              fullWidth
            />
          </View>
        </View>
        <View style={styles.addRow}>
          <View style={styles.addRowBtn}>
            <Button
              title="From Existing"
              onPress={() => setExistingPickerOpen(true)}
              variant="secondary"
              size="sm"
              fullWidth
            />
          </View>
          <View style={styles.addRowBtn}>
            <Button
              title="Import List"
              onPress={() => setImportOpen(true)}
              variant="secondary"
              size="sm"
              fullWidth
            />
          </View>
        </View>

        {items.length > 0 && (
          <Text style={styles.reorderHint}>
            Drag the grip to reorder · hold a task&apos;s grip to move it to a section ·
            hold a section&apos;s grip to drag it with its tasks
          </Text>
        )}
        <DraggableList
          data={items}
          keyExtractor={(item) => item.id}
          onReorder={reorderItems}
          blockSize={blockSizeAt}
          onMoveBlock={moveBlock}
          onDragActiveChange={setReordering}
          onLongPress={(item) => {
            if (item.item_type !== 'section') setMovingItemId(item.id);
          }}
          renderItem={({ item, index, dragging, dragHandlers }) => (
            <SopItemCard
              item={item}
              index={index}
              count={items.length}
              number={itemNumbers[index]}
              dragging={dragging}
              dragHandlers={dragHandlers}
              onOpen={() => setEditingItemId(item.id)}
            />
          )}
        />

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
        onDelete={() => editingItem && removeItem(editingItem.id)}
        onClose={() => setEditingItemId(null)}
      />

      <ExistingItemPickerModal
        visible={existingPickerOpen}
        onClose={() => setExistingPickerOpen(false)}
        onPick={addFromExisting}
      />

      <ImportTasksModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={importItems}
      />

      <SectionPickerModal
        visible={movingItem != null}
        itemTitle={movingItem?.title.trim() || 'this task'}
        sections={sections}
        onPick={moveToSection}
        onClose={() => setMovingItemId(null)}
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
  reorderHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  addRowBtn: {
    flex: 1,
  },
});
