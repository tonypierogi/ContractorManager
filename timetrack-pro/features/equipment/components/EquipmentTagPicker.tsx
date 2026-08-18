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
import { useEquipmentTags, useSaveEquipmentTag } from '@/features/equipment/hooks';
import { findTagByName, toggleTagId } from '@/features/equipment/tags';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface Props {
  /** Tag ids on the item being edited. */
  selected: string[];
  onChange: (tagIds: string[]) => void;
}

/**
 * The Tags field in the equipment editor: tap a chip to tag the item, or type
 * a name to create a tag and tag the item with it in one step — a tag nobody
 * has thought of yet shouldn't mean leaving the form to go make one first.
 */
export default function EquipmentTagPicker({ selected, onChange }: Props) {
  const { data: tags, isLoading } = useEquipmentTags();
  const saveTag = useSaveEquipmentTag();
  const [draft, setDraft] = useState('');

  const handleCreate = async () => {
    const name = draft.trim();
    if (!name) return;

    // Typing a name that already exists just picks it, rather than failing on
    // the unique index behind the admin's back.
    const existing = findTagByName(tags, name);
    if (existing) {
      if (!selected.includes(existing.id)) onChange([...selected, existing.id]);
      setDraft('');
      return;
    }

    try {
      const tag = await saveTag.mutateAsync({ name });
      onChange([...selected, tag.id]);
      setDraft('');
    } catch {
      Alert.alert('Error', 'Failed to create tag');
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.label}>Tags</Text>

      {isLoading ? (
        <ActivityIndicator color={Colors.accent} style={s.loading} />
      ) : (tags ?? []).length === 0 ? (
        <Text style={s.hint}>
          No tags yet — name one below to group gear like "ladders" or "cleaning".
        </Text>
      ) : (
        <View style={s.chipWrap}>
          {(tags ?? []).map((tag) => {
            const active = selected.includes(tag.id);
            return (
              <Pressable
                key={tag.id}
                onPress={() => onChange(toggleTagId(selected, tag.id))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={tag.name}
                style={[s.chip, active && s.chipActive]}
              >
                <Ionicons
                  name={active ? 'checkmark-circle' : 'add-circle-outline'}
                  size={14}
                  color={active ? Colors.accent : Colors.textMuted}
                />
                <Text style={[s.chipLabel, active && s.chipLabelActive]}>
                  {tag.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

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
            s.addBtn,
            (!draft.trim() || saveTag.isPending) && s.addBtnDisabled,
            pressed && s.addBtnPressed,
          ]}
        >
          {saveTag.isPending ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Ionicons name="add" size={20} color={Colors.accent} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loading: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
    minHeight: 34,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  chipLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipLabelActive: {
    color: Colors.accent,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnPressed: {
    backgroundColor: Colors.bgElevated,
  },
});
