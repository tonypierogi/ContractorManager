import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import { useAllTemplateItems } from '@/features/task-lists/hooks';
import type { TemplateItemRef } from '@/features/task-lists/api';
import { ALL_ZONES, getLocationLabel } from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

const MAX_RESULTS = 50;

interface ExistingItemPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPick: (item: TemplateItemRef) => void;
}

/** Search-and-pick a task from any task list or SOP; picking copies it
 * (title, description, photos, equipment, zones) into the current draft. */
export default function ExistingItemPickerModal({
  visible,
  onClose,
  onPick,
}: ExistingItemPickerModalProps) {
  const [search, setSearch] = useState('');
  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<string | null>(null);
  const { data: items, isLoading } = useAllTemplateItems(visible);

  // Only offer chips for rooms/lists that actually appear in the data.
  const rooms = useMemo(() => {
    const present = new Set<string>();
    (items ?? []).forEach((it) => {
      [it.location_from, it.location_to, it.sourceLocation].forEach((z) => {
        if (z) present.add(z);
      });
    });
    return ALL_ZONES.filter((z) => present.has(z.id));
  }, [items]);

  const lists = useMemo(() => {
    const titles = new Set<string>();
    (items ?? []).forEach((it) => {
      if (it.sourceTitle) titles.add(it.sourceTitle);
    });
    return [...titles].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    let all = items ?? [];
    if (roomFilter) {
      all = all.filter(
        (it) =>
          it.location_from === roomFilter ||
          it.location_to === roomFilter ||
          it.sourceLocation === roomFilter,
      );
    }
    if (listFilter) {
      all = all.filter((it) => it.sourceTitle === listFilter);
    }
    if (!query) return all;
    return all.filter((it) => {
      const locationLabels = [it.location_from, it.location_to, it.sourceLocation]
        .filter((z): z is string => !!z)
        .map((z) => getLocationLabel(z).toLowerCase());
      return (
        it.title?.toLowerCase().includes(query) ||
        it.description?.toLowerCase().includes(query) ||
        it.sourceTitle?.toLowerCase().includes(query) ||
        locationLabels.some((l) => l.includes(query))
      );
    });
  }, [items, query, roomFilter, listFilter]);

  const resetFilters = () => {
    setSearch('');
    setRoomFilter(null);
    setListFilter(null);
  };

  const close = () => {
    resetFilters();
    onClose();
  };

  const pick = (it: TemplateItemRef) => {
    resetFilters();
    onPick(it);
  };

  return (
    <Modal visible={visible} onClose={close} title="Add from existing">
      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks, lists, locations…"
          placeholderTextColor={Colors.textMuted}
          style={s.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {rooms.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipRow}
          contentContainerStyle={s.chipRowContent}
        >
          {rooms.map((z) => {
            const active = roomFilter === z.id;
            return (
              <TouchableOpacity
                key={z.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setRoomFilter(active ? null : z.id)}
                accessibilityRole="button"
              >
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={active ? Colors.bgPrimary : Colors.textSecondary}
                />
                <Text style={[s.chipText, active && s.chipTextActive]}>{z.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {lists.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipRow}
          contentContainerStyle={s.chipRowContent}
        >
          {lists.map((title) => {
            const active = listFilter === title;
            return (
              <TouchableOpacity
                key={title}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setListFilter(active ? null : title)}
                accessibilityRole="button"
              >
                <Ionicons
                  name="list-outline"
                  size={12}
                  color={active ? Colors.bgPrimary : Colors.textSecondary}
                />
                <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
                  {title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {isLoading ? (
        <ActivityIndicator color={Colors.accent} style={s.loading} />
      ) : filtered.length === 0 ? (
        <Text style={s.empty}>
          {query || roomFilter || listFilter ? 'No matching tasks.' : 'No tasks to copy yet.'}
        </Text>
      ) : (
        <>
          {filtered.slice(0, MAX_RESULTS).map((it) => {
            const thumb = it.media.find((m) => m.type === 'image')?.url;
            const zone = it.location_from ?? it.location_to ?? it.sourceLocation;
            return (
              <TouchableOpacity
                key={it.key}
                style={s.row}
                onPress={() => pick(it)}
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={s.thumb} />
                ) : (
                  <View style={[s.thumb, s.thumbFallback]}>
                    <Ionicons
                      name={it.source === 'sop' ? 'clipboard-outline' : 'list-outline'}
                      size={16}
                      color={Colors.textSecondary}
                    />
                  </View>
                )}
                <View style={s.rowBody}>
                  <Text style={s.rowTitle}>{it.title}</Text>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {it.sourceTitle}
                    {zone ? `  ·  ${getLocationLabel(zone)}` : ''}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
              </TouchableOpacity>
            );
          })}
          {filtered.length > MAX_RESULTS && (
            <Text style={s.more}>
              Showing first {MAX_RESULTS} of {filtered.length} — refine your search.
            </Text>
          )}
        </>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
  },
  chipRow: {
    flexGrow: 0,
    marginBottom: Spacing.sm,
  },
  chipRowContent: {
    gap: Spacing.xs,
    paddingRight: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs + 1,
    paddingHorizontal: Spacing.sm + 2,
    maxWidth: 200,
  },
  chipActive: {
    backgroundColor: Colors.accent,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.bgPrimary,
    fontWeight: '600',
  },
  loading: {
    paddingVertical: Spacing.xl,
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
    flexShrink: 0,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  rowMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  more: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});
