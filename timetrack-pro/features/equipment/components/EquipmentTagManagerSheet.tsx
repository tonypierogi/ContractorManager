import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet from '@/components/ui/Sheet';
import {
  useEquipment,
  useEquipmentTags,
  useDeleteEquipmentTag,
  useSaveEquipmentTag,
} from '@/features/equipment/hooks';
import { findTagByName, tagUsageCounts } from '@/features/equipment/tags';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Admin-only tag housekeeping: make a tag, fix its name, or retire one. Tags
 * get typed in a hurry from the equipment editor, so there has to be a place
 * to correct a typo without touching every item that carries it.
 */
export default function EquipmentTagManagerSheet({ visible, onClose }: Props) {
  const { data: tags, isLoading } = useEquipmentTags();
  const { data: equipment } = useEquipment();
  const saveTag = useSaveEquipmentTag();
  const deleteTag = useDeleteEquipmentTag();

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const counts = tagUsageCounts(equipment);

  const close = () => {
    setDraft('');
    setEditingId(null);
    onClose();
  };

  const handleCreate = async () => {
    const name = draft.trim();
    if (!name) return;
    if (findTagByName(tags, name)) {
      Alert.alert('Already a tag', `"${name}" is already in the list.`);
      return;
    }
    try {
      await saveTag.mutateAsync({ name });
      setDraft('');
    } catch {
      Alert.alert('Error', 'Failed to create tag');
    }
  };

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleRename = async () => {
    const name = editingName.trim();
    if (!editingId || !name) return;
    const clash = findTagByName(tags, name);
    if (clash && clash.id !== editingId) {
      Alert.alert('Already a tag', `"${name}" is already in the list.`);
      return;
    }
    try {
      await saveTag.mutateAsync({ id: editingId, name });
      setEditingId(null);
    } catch {
      Alert.alert('Error', 'Failed to rename tag');
    }
  };

  const handleDelete = (id: string, name: string) => {
    const used = counts.get(id) ?? 0;
    Alert.alert(
      'Delete tag',
      used > 0
        ? `"${name}" is on ${used} ${used === 1 ? 'item' : 'items'}. Deleting it takes it off them — the items themselves stay.`
        : `Delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTag.mutateAsync(id);
            } catch {
              Alert.alert('Error', 'Failed to delete tag');
            }
          },
        },
      ],
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Equipment tags"
      subtitle="Group gear so anyone can filter down to it"
    >
      <View style={s.newRow}>
        <TextInput
          style={s.newInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="New tag..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
          accessibilityLabel="New tag name"
        />
        <Pressable
          onPress={handleCreate}
          disabled={!draft.trim() || saveTag.isPending}
          accessibilityRole="button"
          accessibilityLabel="Create tag"
          style={({ pressed }) => [
            s.iconBtn,
            s.addBtn,
            (!draft.trim() || saveTag.isPending) && s.disabled,
            pressed && s.pressed,
          ]}
        >
          {saveTag.isPending && !editingId ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Ionicons name="add" size={20} color={Colors.accent} />
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.accent} style={s.loading} />
      ) : (tags ?? []).length === 0 ? (
        <Text style={s.empty}>
          No tags yet. Add one above, then tick it on any piece of equipment.
        </Text>
      ) : (
        (tags ?? []).map((tag) => {
          const used = counts.get(tag.id) ?? 0;
          const isEditing = editingId === tag.id;
          return (
            <View key={tag.id} style={s.row}>
              {isEditing ? (
                <>
                  <TextInput
                    style={[s.newInput, s.renameInput]}
                    value={editingName}
                    onChangeText={setEditingName}
                    autoFocus
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleRename}
                    accessibilityLabel={`Rename ${tag.name}`}
                  />
                  <Pressable
                    onPress={handleRename}
                    accessibilityRole="button"
                    accessibilityLabel="Save name"
                    style={({ pressed }) => [s.iconBtn, s.addBtn, pressed && s.pressed]}
                  >
                    <Ionicons name="checkmark" size={18} color={Colors.accent} />
                  </Pressable>
                  <Pressable
                    onPress={() => setEditingId(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel rename"
                    style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
                  >
                    <Ionicons name="close" size={18} color={Colors.textSecondary} />
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={s.rowBody}>
                    <Text style={s.rowName} numberOfLines={1}>
                      {tag.name}
                    </Text>
                    <Text style={s.rowMeta}>
                      {used === 0
                        ? 'Not on any equipment yet'
                        : `On ${used} ${used === 1 ? 'item' : 'items'}`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => startRename(tag.id, tag.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Rename ${tag.name}`}
                    style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
                  >
                    <Ionicons name="pencil" size={16} color={Colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(tag.id, tag.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${tag.name}`}
                    style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  </Pressable>
                </>
              )}
            </View>
          );
        })
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  newInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  renameInput: {
    marginVertical: Spacing.xs,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    backgroundColor: Colors.bgElevated,
  },
  loading: {
    marginVertical: Spacing.lg,
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },
  rowMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
