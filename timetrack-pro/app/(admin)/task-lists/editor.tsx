import { useState } from 'react';
import {
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
import { useSaveTaskList } from '@/hooks/useTaskLists';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface ItemDraft {
  id: string;
  title: string;
  description: string;
}

let nextId = 0;
const makeId = () => `draft-${++nextId}`;

export default function TaskListEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const saveTaskList = useSaveTaskList();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoMode, setVideoMode] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([]);

  const addItem = () => {
    setItems((prev) => [...prev, { id: makeId(), title: '', description: '' }]);
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
        items: items.map((i) => ({
          title: i.title,
          description: i.description || undefined,
        })),
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save task list');
    }
  };

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
