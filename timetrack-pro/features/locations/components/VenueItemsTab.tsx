import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import Lightbox from '@/components/ui/Lightbox';
import Button from '@/components/ui/Button';
import EquipmentEditorModal from '@/features/equipment/components/EquipmentEditorModal';
import { useEquipment } from '@/features/equipment/hooks';
import {
  LOCATION_ZONES,
  FLOOR_PLAN_HIGHLIGHT,
  getLocationLabel,
  zoneFloor,
} from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import type { Equipment } from '@/types/database';

interface ZoneChip {
  id: string | null;
  label: string;
}

// "All" first, then zones in floor order — same order the building is walked.
const ZONE_CHIPS: ZoneChip[] = [
  { id: null, label: 'All' },
  ...LOCATION_ZONES.upstairs.map((z) => ({ id: z.id as string | null, label: z.label })),
  ...LOCATION_ZONES.downstairs.map((z) => ({ id: z.id as string | null, label: z.label })),
];

interface Props {
  /** Admins get add/edit/delete on equipment items. */
  canEdit?: boolean;
}

/**
 * "Where's the vacuum?" finder over the equipment table: search by name,
 * narrow by zone, tap an item for its photo and location.
 */
export default function VenueItemsTab({ canEdit = false }: Props) {
  const { data: equipment, isLoading, refetch } = useEquipment();

  const [query, setQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<Equipment | null>(null);

  const openAdd = () => {
    setEditorItem(null);
    setEditorOpen(true);
  };

  const openEdit = (item: Equipment) => {
    setSelected(null);
    setEditorItem(item);
    setEditorOpen(true);
  };

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (equipment ?? []).filter(
      (item) =>
        (!q || item.name.toLowerCase().includes(q)) &&
        (!zoneFilter || item.location === zoneFilter),
    );
  }, [equipment, query, zoneFilter]);

  const selectedFloor = selected?.location ? zoneFloor(selected.location) : null;
  const selectedPlan =
    selected?.location != null ? FLOOR_PLAN_HIGHLIGHT[selected.location] : undefined;

  const listHeader = (
    <View>
      <View style={s.searchRow}>
        <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search items... (vacuum, walkie, ladder)"
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
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
        {canEdit && (
          <Pressable
            onPress={openAdd}
            accessibilityRole="button"
            accessibilityLabel="Add equipment"
            style={({ pressed }) => [s.addBtn, pressed && s.addBtnPressed]}
          >
            <Ionicons name="add" size={22} color={Colors.accent} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
      >
        {ZONE_CHIPS.map((chip) => {
          const isActive = zoneFilter === chip.id;
          return (
            <Pressable
              key={chip.id ?? 'all'}
              onPress={() => setZoneFilter(chip.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[s.chip, isActive && s.chipActive]}
            >
              <Text style={[s.chipLabel, isActive && s.chipLabelActive]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={s.list}
        refreshing={isLoading}
        onRefresh={refetch}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item)}
            accessibilityRole="button"
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={s.thumb} resizeMode="cover" />
            ) : (
              <View style={[s.thumb, s.thumbPlaceholder]}>
                <Ionicons name="construct-outline" size={20} color={Colors.textMuted} />
              </View>
            )}
            <View style={s.rowBody}>
              <Text style={s.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={s.rowZoneWrap}>
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={item.location ? Colors.accent : Colors.textMuted}
                />
                <Text
                  style={[s.rowZone, !item.location && s.rowZoneMissing]}
                  numberOfLines={1}
                >
                  {item.location
                    ? getLocationLabel(item.location)
                    : 'No location recorded'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={s.empty}>
              <Ionicons name="construct-outline" size={40} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>
                {query.trim() || zoneFilter ? 'No items match' : 'No items yet'}
              </Text>
              <Text style={s.emptyText}>
                {query.trim() || zoneFilter
                  ? 'Try a different search or location filter.'
                  : canEdit
                    ? 'Tap + to add your first piece of equipment.'
                    : 'Equipment added by an admin shows up here.'}
              </Text>
            </View>
          ) : null
        }
      />

      <Modal
        visible={selected != null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
      >
        {selected && (
          <View>
            {selected.image_url ? (
              <Pressable
                onPress={() => setLightboxOpen(true)}
                accessibilityRole="imagebutton"
                accessibilityLabel={selected.name}
              >
                <Image
                  source={{ uri: selected.image_url }}
                  style={s.detailImage}
                  resizeMode="cover"
                />
              </Pressable>
            ) : (
              <View style={[s.detailImage, s.detailImagePlaceholder]}>
                <Ionicons name="construct-outline" size={40} color={Colors.textMuted} />
                <Text style={s.detailNoPhoto}>No photo yet</Text>
              </View>
            )}

            <View style={s.detailZoneRow}>
              <Ionicons
                name="location"
                size={16}
                color={selected.location ? Colors.accent : Colors.textMuted}
              />
              <Text
                style={[s.detailZone, !selected.location && s.detailZoneMissing]}
              >
                {selected.location
                  ? getLocationLabel(selected.location)
                  : 'No location recorded'}
              </Text>
              {selectedFloor && (
                <Text style={s.detailFloor}>
                  · {selectedFloor === 'upstairs' ? 'Upstairs' : 'Downstairs'}
                </Text>
              )}
            </View>

            {selectedPlan && (
              <Image
                source={selectedPlan}
                style={s.detailPlan}
                resizeMode="contain"
                accessibilityLabel={`Floor plan showing ${getLocationLabel(selected.location!)}`}
              />
            )}

            {canEdit && (
              <View style={s.detailEditRow}>
                <Button
                  title="Edit"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onPress={() => openEdit(selected)}
                />
              </View>
            )}
          </View>
        )}
      </Modal>

      {canEdit && (
        <EquipmentEditorModal
          visible={editorOpen}
          item={editorItem}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {selected?.image_url ? (
        <Lightbox
          images={[selected.image_url]}
          visible={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
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
  addBtnPressed: {
    backgroundColor: Colors.bgElevated,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  chipRow: {
    gap: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  chip: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.sm,
    minHeight: 60,
    ...Shadows.sm,
  },
  rowPressed: {
    backgroundColor: Colors.bgElevated,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  rowZoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rowZone: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '500',
    flexShrink: 1,
  },
  rowZoneMissing: {
    color: Colors.textMuted,
    fontWeight: '400',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  detailImage: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    marginBottom: Spacing.md,
  },
  detailImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  detailNoPhoto: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  detailZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  detailZone: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.accent,
  },
  detailZoneMissing: {
    color: Colors.textMuted,
    fontWeight: '400',
  },
  detailFloor: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  detailPlan: {
    width: '100%',
    height: 320,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailEditRow: {
    marginTop: Spacing.md,
  },
});
