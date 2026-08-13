import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import { useAllTemplateItems } from '@/features/task-lists/hooks';
import type { TemplateItemRef } from '@/features/task-lists/api';
import { getLocationLabel } from '@/features/locations/zones';
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
  const { data: items, isLoading } = useAllTemplateItems(visible);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const all = items ?? [];
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
  }, [items, query]);

  const close = () => {
    setSearch('');
    onClose();
  };

  const pick = (it: TemplateItemRef) => {
    setSearch('');
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

      {isLoading ? (
        <ActivityIndicator color={Colors.accent} style={s.loading} />
      ) : filtered.length === 0 ? (
        <Text style={s.empty}>{query ? 'No matching tasks.' : 'No tasks to copy yet.'}</Text>
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
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {it.title}
                  </Text>
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
