import { useEffect, useState } from 'react';
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
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useSaveTaskList, useTaskList } from '@/features/task-lists/hooks';
import LocationZonePicker from '@/features/locations/components/LocationZonePicker';
import type { MediaItem } from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface ItemDraft {
  id: string;
  title: string;
  description: string;
  // Carried through the editor untouched (no UI yet) so editing a list the
  // legacy app created never strips these columns on save.
  item_type: string | null;
  media: MediaItem[];
  location_from: string | null;
  location_to: string | null;
  equipment: string[];
  video_timestamp: number | null;
}

let nextId = 0;
const makeId = () => `draft-${++nextId}`;

const makeDraft = (): ItemDraft => ({
  id: makeId(),
  title: '',
  description: '',
  item_type: 'task',
  media: [],
  location_from: null,
  location_to: null,
  equipment: [],
  video_timestamp: null,
});

export default function TaskListEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const saveTaskList = useSaveTaskList();
  const { data: existing } = useTaskList(id ?? '');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSop, setIsSop] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(null);
  const [sourceTranscript, setSourceTranscript] = useState<string | null>(null);
  const [videoMode, setVideoMode] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);

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
    setItems(
      rows.map((it) => ({
        id: it.id,
        title: it.title ?? '',
        description: it.description ?? '',
        item_type: it.item_type ?? 'task',
        media: it.media ?? [],
        location_from: it.location_from ?? null,
        location_to: it.location_to ?? null,
        equipment: it.equipment ?? [],
        video_timestamp: it.video_timestamp ?? null,
      })),
    );
    setHydrated(true);
  }, [id, existing, hydrated]);

  const addItem = () => {
    setItems((prev) => [...prev, makeDraft()]);
  };

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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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

        <Text style={styles.pickerLabel}>Location</Text>
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

        {videoMode ? (
          <Card style={styles.videoCard}>
            <Text style={styles.videoText}>
              Video upload and processing will be available here.
            </Text>
            <Button title="Pick Video" onPress={() => {}} variant="secondary" />
          </Card>
        ) : (
          <>
            <Text style={styles.subheading}>Items</Text>
            {items.map((item, index) => (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemNumber}>#{index + 1}</Text>
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
                  placeholder="Task title"
                  value={item.title}
                  onChangeText={(v) => updateItem(item.id, 'title', v)}
                />
                <Input
                  placeholder="Description (optional)"
                  value={item.description}
                  onChangeText={(v) => updateItem(item.id, 'description', v)}
                />
              </Card>
            ))}
            <Button
              title="Add Item"
              onPress={addItem}
              variant="secondary"
              size="sm"
            />
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
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
  videoCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  videoText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
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
