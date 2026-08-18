import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/auth-provider';
import { useEquipment } from '@/features/equipment/hooks';
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
import {
  useImportTaskVideo,
  useSaveTaskList,
  useTaskList,
  useUploadTaskListMedia,
} from '@/features/task-lists/hooks';
import ItemEditorCard, {
  makeDraft,
  type ItemDraft,
} from '@/features/task-lists/components/ItemEditorCard';
import ItemEditorSheet from '@/features/task-lists/components/ItemEditorSheet';
import SectionPickerModal from '@/features/task-lists/components/SectionPickerModal';
import VideoImportCard from '@/features/task-lists/components/VideoImportCard';
import ExistingItemPickerModal from '@/features/task-lists/components/ExistingItemPickerModal';
import ImportTasksModal from '@/features/task-lists/components/ImportTasksModal';
import type { ParsedImportItem } from '@/features/task-lists/import-text';
import DraggableList from '@/components/ui/DraggableList';
import type { TemplateItemRef } from '@/features/task-lists/api';
import type { TaskEquipmentRef } from '@/types/database';
import LocationZonePicker from '@/features/locations/components/LocationZonePicker';
import { pickPhotoAsset, type PhotoSource } from '@/lib/photo-picker';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export default function TaskListEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const saveTaskList = useSaveTaskList();
  const uploadMedia = useUploadTaskListMedia();
  const importVideo = useImportTaskVideo();
  const { data: existing } = useTaskList(id ?? '');
  const { data: equipment } = useEquipment();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSop, setIsSop] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(null);
  const [sourceTranscript, setSourceTranscript] = useState<string | null>(null);
  const [videoMode, setVideoMode] = useState(false);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  // Which item is open in the editing sheet; the list itself stays collapsed.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [existingPickerOpen, setExistingPickerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Which item is being sent to a section (set by holding its move arrow).
  const [movingItemId, setMovingItemId] = useState<string | null>(null);

  const equipmentById = useMemo(
    () => new Map((equipment ?? []).map((eq) => [eq.id, eq.name])),
    [equipment],
  );
  // Where each piece of equipment lives, so tagging it on a task fills the
  // room in instead of asking for it again.
  const equipmentHomes = useMemo(() => equipmentHomeZones(equipment), [equipment]);
  // ...and what it looks like, so tagging it also shows the crew the thing.
  const equipmentPhotos = useMemo(() => equipmentImages(equipment), [equipment]);

  // Editing: populate the form from the existing list exactly once. Without
  // this, saving an edit overwrote the list with the blank form.
  useEffect(() => {
    if (!id || !existing || hydrated) return;
    const { taskList, items: rows } = existing;
    setTitle(taskList.title ?? '');
    setDescription(taskList.description ?? '');
    setIsSop(taskList.is_sop);
    setLocation(taskList.location ?? null);
    setSourceVideoUrl(taskList.source_video_url ?? null);
    setSourceTranscript(taskList.source_transcript ?? null);
    // Reveal the video panel when the list already came from one.
    setVideoMode(!!taskList.source_video_url);
    setItems(
      rows.map((it) => ({
        id: it.id,
        title: it.title ?? '',
        description: it.description ?? '',
        item_type: it.item_type ?? 'task',
        media: it.media ?? [],
        location_from: it.location_from ?? null,
        location_to: it.location_to ?? null,
        equipment: parseEquipmentRefs(it.equipment),
        video_timestamp: it.video_timestamp ?? null,
      })),
    );
    setHydrated(true);
  }, [id, existing, hydrated]);

  // A brand new item opens straight into the sheet — there is nothing to see
  // on its collapsed row yet.
  const addItem = (itemType: 'task' | 'section' = 'task') => {
    const draft = makeDraft(itemType);
    setItems((prev) => [...prev, draft]);
    setEditingItemId(draft.id);
  };

  // Pasted notes become plain drafts: photos, gear and rooms are added after,
  // in the same editor as everything else.
  const importItems = (parsed: ParsedImportItem[]) => {
    setItems((prev) => [
      ...prev,
      ...parsed.map((it) => ({
        ...makeDraft(it.item_type),
        title: it.title,
        description: it.description,
      })),
    ]);
    setImportOpen(false);
    showToast(
      `Added ${parsed.length} item${parsed.length === 1 ? '' : 's'} from notes`,
    );
  };

  // Copy a task from another list or SOP into this draft (title, description,
  // photos, equipment, zones — media URLs are shared, not re-uploaded).
  const addFromExisting = (tpl: TemplateItemRef) => {
    const equipmentRefs = tpl.equipment.map((ref) => ({ ...ref }));
    setItems((prev) => [
      ...prev,
      {
        ...makeDraft(),
        title: tpl.title,
        description: tpl.description ?? '',
        item_type: tpl.item_type ?? 'task',
        // Copied tasks pick up any equipment photo the original predates.
        media: syncEquipmentMedia([...tpl.media], [], equipmentRefs, equipmentPhotos),
        location_from: tpl.location_from,
        location_to: tpl.location_to,
        equipment: equipmentRefs,
      },
    ]);
    setExistingPickerOpen(false);
  };

  const updateItem = (itemId: string, field: keyof ItemDraft, value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)),
    );
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setEditingItemId((current) => (current === itemId ? null : current));
  };

  const patchItem = (itemId: string, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
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

  // Pick a walkthrough video, upload it, and append the tasks the transcript
  // produced. Generated tasks are appended (never replacing existing ones) so
  // re-running on an edited list can't wipe hand-written items.
  const handlePickVideo = async () => {
    if (!user) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'video.mp4';
    setVideoName(name);
    try {
      const result = await importVideo.mutateAsync({
        userId: user.id,
        uri: asset.uri,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
        onStage: setVideoStatus,
      });
      setSourceVideoUrl(result.videoUrl);
      setSourceTranscript(result.transcript || null);
      if (result.items.length === 0) {
        showToast('No tasks were found in that video', 'error');
        return;
      }
      setItems((prev) => [
        ...prev,
        ...result.items.map((task) => ({
          ...makeDraft(),
          title: task.title,
          description: task.description,
          video_timestamp: task.video_timestamp,
        })),
      ]);
      showToast(
        `Generated ${result.items.length} task${result.items.length === 1 ? '' : 's'} from video`,
      );
    } catch {
      // surfaced by the global mutation error toast
      setVideoName(null);
    } finally {
      setVideoStatus(null);
    }
  };

  const clearVideo = () => {
    setSourceVideoUrl(null);
    setSourceTranscript(null);
    setVideoName(null);
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

  // Every equipment change goes through here so the task's photos follow the
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

  // Sections aren't steps, so they don't take a number — the tasks around
  // them keep counting as the crew will read them.
  const itemNumbers = useMemo(() => {
    let n = 0;
    return items.map((i) => (i.item_type === 'section' ? null : ++n));
  }, [items]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setItems((prev) => {
      const arr = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
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
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    try {
      await saveTaskList.mutateAsync({
        id: id || undefined,
        title,
        description,
        isSop,
        location,
        createdBy: user?.id,
        sourceVideoUrl,
        sourceTranscript,
        items: items.map((i) => ({
          title: i.title,
          description: i.description || undefined,
          item_type: i.item_type,
          media: i.media,
          location_from: i.location_from,
          location_to: i.location_to,
          equipment: i.equipment,
          video_timestamp: i.video_timestamp,
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
          title="Save Task List"
          onPress={handleSave}
          loading={saveTaskList.isPending}
          size="sm"
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>
          {id ? 'Edit Task List' : 'New Task List'}
        </Text>

        <Input
          label="Title"
          placeholder="e.g. Onboarding Checklist"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Description"
          placeholder="Brief description"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>SOP (repeatable checklist)</Text>
          <Switch
            value={isSop}
            onValueChange={setIsSop}
            trackColor={{ false: Colors.border, true: Colors.accent }}
            thumbColor={Colors.text}
          />
        </View>

        <LocationZonePicker value={location} onChange={setLocation} />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Create from video</Text>
          <Switch
            value={videoMode}
            onValueChange={setVideoMode}
            trackColor={{ false: Colors.border, true: Colors.accent }}
            thumbColor={Colors.text}
          />
        </View>

        {videoMode && (
          <VideoImportCard
            videoUrl={sourceVideoUrl}
            fileName={videoName}
            transcript={sourceTranscript}
            busy={importVideo.isPending}
            status={videoStatus}
            onPick={handlePickVideo}
            onClear={clearVideo}
          />
        )}

        {/* Generated tasks land in the same editor as hand-written ones, so
            they can be reordered, photographed and tagged before saving. */}
        <Text style={styles.subheading}>Items</Text>
        {/* Adding sits above the list: on a fifty-task list the buttons stay
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
            Drag the grip to reorder · hold an arrow to move a task to a section
          </Text>
        )}
        <DraggableList
          data={items}
          keyExtractor={(item) => item.id}
          onReorder={reorderItems}
          renderItem={({ item, index, dragging, dragHandlers }) => (
            <ItemEditorCard
              item={item}
              index={index}
              number={itemNumbers[index]}
              count={items.length}
              dragging={dragging}
              dragHandlers={dragHandlers}
              onOpen={() => setEditingItemId(item.id)}
              onMove={(direction) => moveItem(index, direction)}
              onMoveToSection={
                item.item_type === 'section'
                  ? undefined
                  : () => setMovingItemId(item.id)
              }
              onRemove={() => removeItem(item.id)}
            />
          )}
        />

      </ScrollView>

      <ItemEditorSheet
        item={editingItem}
        index={editingIndex}
        equipment={equipment}
        equipmentById={equipmentById}
        equipmentHomes={equipmentHomes}
        uploading={!!editingItem && uploadingItemId === editingItem.id}
        onUpdateField={(field, value) =>
          editingItem && updateItem(editingItem.id, field, value)
        }
        onSetLocation={(field, zoneId) =>
          editingItem && patchItem(editingItem.id, { [field]: zoneId })
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  switchLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
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
  itemNumber: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
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
});
