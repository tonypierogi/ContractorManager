import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import EquipmentTagChips from '@/features/equipment/components/EquipmentTagChips';
import EquipmentTagFilterRow from '@/features/equipment/components/EquipmentTagFilterRow';
import { useEquipmentTags } from '@/features/equipment/hooks';
import {
  EQUIPMENT_MODE_DESCRIPTION,
  EQUIPMENT_MODE_FIELD_LABEL,
  EQUIPMENT_MODE_LABEL,
} from '@/features/equipment/refs';
import {
  matchesTagFilter,
  tagsById,
  tagsForEquipment,
  toggleTagId,
} from '@/features/equipment/tags';
import { useLocationZones } from '@/features/locations/hooks';
import { getLocationLabel } from '@/features/locations/zones';
import type { Equipment, EquipmentLinkMode } from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface Props {
  /** Which list is being added to; null closes the sheet. */
  mode: EquipmentLinkMode | null;
  equipment: Equipment[] | undefined;
  /** equipment id -> how it's linked on this task; absent ids aren't linked. */
  selected: Map<string, EquipmentLinkMode>;
  /** Tapping a row: link it in `mode`, or unlink it if it's already there. */
  onToggle: (equipmentId: string, mode: EquipmentLinkMode) => void;
  onClose: () => void;
}

/**
 * Pick equipment for one side of a task (get it, or bring it back). A bottom
 * sheet rather than a dialog because picking is a step inside editing the
 * task, and because the list needs room: crews recognise their gear by sight,
 * so every row carries its photo, the room it lives in and its tags, with a
 * name search plus room and tag filters over the top for the long tail.
 */
export default function EquipmentPickerSheet({
  mode,
  equipment,
  selected,
  onToggle,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const { floors } = useLocationZones();
  const { data: tags } = useEquipmentTags();

  // "All" first, then rooms in floor order — the order the building is walked.
  const roomFilters = useMemo(
    () => [
      { id: null as string | null, label: 'All rooms' },
      ...floors.upstairs.map((z) => ({ id: z.id as string | null, label: z.label })),
      ...floors.downstairs.map((z) => ({ id: z.id as string | null, label: z.label })),
    ],
    [floors],
  );

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (equipment ?? []).filter(
      (item) =>
        (!q || item.name.toLowerCase().includes(q)) &&
        (!room || item.location === room) &&
        matchesTagFilter(item, tagFilter),
    );
  }, [equipment, query, room, tagFilter]);

  const tagLookup = useMemo(() => tagsById(tags), [tags]);

  const close = () => {
    setQuery('');
    setRoom(null);
    setTagFilter([]);
    onClose();
  };

  const linkedHere = mode
    ? (equipment ?? []).filter((e) => selected.get(e.id) === mode).length
    : 0;

  return (
    <Sheet
      visible={mode != null}
      onClose={close}
      title={mode ? EQUIPMENT_MODE_FIELD_LABEL[mode] : ''}
      subtitle={mode ? EQUIPMENT_MODE_DESCRIPTION[mode] : null}
    >
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search equipment..."
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          accessibilityLabel="Search equipment by name"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        {roomFilters.map((chip) => {
          const active = room === chip.id;
          return (
            <Pressable
              key={chip.id ?? 'all'}
              onPress={() => setRoom(chip.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipLabel, active && s.chipLabelActive]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <EquipmentTagFilterRow
        tags={tags}
        selected={tagFilter}
        onToggle={(tagId) => setTagFilter((prev) => toggleTagId(prev, tagId))}
        onClear={() => setTagFilter([])}
      />

      {items.length === 0 ? (
        <Text style={s.empty}>
          {(equipment ?? []).length === 0
            ? 'No equipment yet — add some on the Equipment screen first.'
            : 'Nothing matches that search, room or tag.'}
        </Text>
      ) : (
        items.map((item) => {
          const linkedAs = selected.get(item.id);
          const checked = linkedAs === mode;
          // Linked on the other side of the same task — say so, since tapping
          // here moves it rather than adding a second copy.
          const otherMode = linkedAs && linkedAs !== mode ? linkedAs : null;
          return (
            <Pressable
              key={item.id}
              onPress={() => mode && onToggle(item.id, mode)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={item.name}
              style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            >
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={s.thumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={[s.thumb, s.thumbEmpty]}>
                  <Ionicons name="cube-outline" size={20} color={Colors.textMuted} />
                </View>
              )}

              <View style={s.rowBody}>
                <Text style={s.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={s.rowMeta}>
                  <Ionicons
                    name="location-outline"
                    size={12}
                    color={item.location ? Colors.accent : Colors.textMuted}
                  />
                  <Text
                    style={[s.rowRoom, !item.location && s.rowRoomMissing]}
                    numberOfLines={1}
                  >
                    {item.location ? getLocationLabel(item.location) : 'No room recorded'}
                  </Text>
                  {otherMode ? (
                    <View style={s.otherBadge}>
                      <Text style={s.otherBadgeText}>
                        {EQUIPMENT_MODE_LABEL[otherMode]}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {item.tag_ids.length > 0 ? (
                  <View style={s.rowTags}>
                    <EquipmentTagChips tags={tagsForEquipment(item, tagLookup)} max={2} />
                  </View>
                ) : null}
              </View>

              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? Colors.accent : Colors.textSecondary}
              />
            </Pressable>
          );
        })
      )}

      <View style={s.doneRow}>
        <Button
          title={linkedHere > 0 ? `Done (${linkedHere})` : 'Done'}
          onPress={close}
          fullWidth
        />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  chipRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
    minHeight: 32,
    justifyContent: 'center',
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
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 60,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  rowPressed: {
    backgroundColor: Colors.bgElevated,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rowRoom: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    flexShrink: 1,
  },
  rowRoomMissing: {
    color: Colors.textMuted,
  },
  rowTags: {
    marginTop: 4,
  },
  otherBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  otherBadgeText: {
    fontSize: FontSize.xxs,
    fontWeight: '700',
    color: Colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  doneRow: {
    marginTop: Spacing.lg,
  },
});
