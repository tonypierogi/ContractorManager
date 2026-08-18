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
import type { ImageSourcePropType } from 'react-native';
import Modal from '@/components/ui/Modal';
import Lightbox from '@/components/ui/Lightbox';
import AnnotatedImage from '@/components/ui/AnnotatedImage';
import Button from '@/components/ui/Button';
import EquipmentEditorModal from '@/features/equipment/components/EquipmentEditorModal';
import EquipmentTagChips from '@/features/equipment/components/EquipmentTagChips';
import EquipmentTagFilterRow from '@/features/equipment/components/EquipmentTagFilterRow';
import EquipmentTagManagerSheet from '@/features/equipment/components/EquipmentTagManagerSheet';
import { useEquipment, useEquipmentTags } from '@/features/equipment/hooks';
import {
  matchesTagFilter,
  pruneTagFilter,
  tagsById,
  tagsForEquipment,
  toggleTagId,
} from '@/features/equipment/tags';
import { useLocationZones } from '@/features/locations/hooks';
import {
  FLOOR_PLAN_HIGHLIGHT,
  getLocationLabel,
  getZonePhoto,
  zoneFloor,
} from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import type { Equipment } from '@/types/database';

interface ZoneChip {
  id: string | null;
  label: string;
}

interface Props {
  /** Admins get add/edit/delete on equipment items. */
  canEdit?: boolean;
}

/**
 * "Where's the vacuum?" finder over the equipment table: search by name,
 * narrow by room or tag, tap an item for its photo and location. Contractors
 * get the same search and filters as admins — only the add/edit/tag-manage
 * controls are gated on `canEdit`.
 */
export default function VenueItemsTab({ canEdit = false }: Props) {
  const { data: equipment, isLoading, refetch } = useEquipment();
  const { data: tags } = useEquipmentTags();
  const { floors } = useLocationZones();

  // "All" first, then rooms in floor order — the order the building is walked.
  const zoneChips: ZoneChip[] = useMemo(
    () => [
      { id: null, label: 'All' },
      ...floors.upstairs.map((z) => ({ id: z.id as string | null, label: z.label })),
      ...floors.downstairs.map((z) => ({ id: z.id as string | null, label: z.label })),
    ],
    [floors],
  );

  const [query, setQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<Equipment | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const openAdd = () => {
    setEditorItem(null);
    setEditorOpen(true);
  };

  const openEdit = (item: Equipment) => {
    setSelected(null);
    setEditorItem(item);
    setEditorOpen(true);
  };

  const tagLookup = useMemo(() => tagsById(tags), [tags]);
  // Ignore tags deleted since they were picked, so the filter can't get stuck.
  const activeTagFilter = useMemo(
    () => pruneTagFilter(tagFilter, tagLookup),
    [tagFilter, tagLookup],
  );

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (equipment ?? []).filter(
      (item) =>
        (!q || item.name.toLowerCase().includes(q)) &&
        (!zoneFilter || item.location === zoneFilter) &&
        matchesTagFilter(item, activeTagFilter),
    );
  }, [equipment, query, zoneFilter, activeTagFilter]);

  const selectedTags = selected ? tagsForEquipment(selected, tagLookup) : [];
  const isFiltered = !!query.trim() || !!zoneFilter || activeTagFilter.length > 0;

  const selectedFloor = selected?.location ? zoneFloor(selected.location) : null;
  const selectedPlan =
    selected?.location != null ? FLOOR_PLAN_HIGHLIGHT[selected.location] : undefined;
  const selectedZonePhoto = getZonePhoto(selected?.location);
  const selectedZoneLabel = selected?.location ? getLocationLabel(selected.location) : '';

  // Item photo first, then the location shots, so tapping any of them opens
  // the lightbox on that image and swipes through the rest.
  const lightboxImages = useMemo(() => {
    const images: (string | ImageSourcePropType)[] = [];
    if (selected?.image_url) images.push(selected.image_url);
    if (selectedZonePhoto) images.push(selectedZonePhoto);
    if (selectedPlan) images.push(selectedPlan);
    return images;
  }, [selected?.image_url, selectedZonePhoto, selectedPlan]);

  // Positional match to lightboxImages: only the item photo can carry marks,
  // and it is always first when it's there at all.
  const lightboxAnnotations = useMemo(
    () => (selected?.image_url ? [selected.image_annotations ?? []] : []),
    [selected?.image_url, selected?.image_annotations],
  );

  const openLightbox = (image: string | ImageSourcePropType | undefined) => {
    const index = image ? lightboxImages.indexOf(image) : -1;
    if (index < 0) return;
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

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
          <>
            <Pressable
              onPress={() => setTagManagerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Manage tags"
              style={({ pressed }) => [s.iconBtn, pressed && s.addBtnPressed]}
            >
              <Ionicons name="pricetags-outline" size={19} color={Colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={openAdd}
              accessibilityRole="button"
              accessibilityLabel="Add equipment"
              style={({ pressed }) => [s.addBtn, pressed && s.addBtnPressed]}
            >
              <Ionicons name="add" size={22} color={Colors.accent} />
            </Pressable>
          </>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
      >
        {zoneChips.map((chip) => {
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

      <EquipmentTagFilterRow
        tags={tags}
        selected={activeTagFilter}
        onToggle={(tagId) => setTagFilter((prev) => toggleTagId(prev, tagId))}
        onClear={() => setTagFilter([])}
      />
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
              // Thumbnails crop, which would slice a circle in half — so they
              // show a badge instead, and the marks appear once it's opened.
              <View>
                <Image source={{ uri: item.image_url }} style={s.thumb} resizeMode="cover" />
                {item.image_annotations?.length ? (
                  <View style={s.thumbBadge}>
                    <Ionicons name="brush" size={9} color={Colors.bgPrimary} />
                  </View>
                ) : null}
              </View>
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
              {item.tag_ids.length > 0 ? (
                <View style={s.rowTags}>
                  <EquipmentTagChips tags={tagsForEquipment(item, tagLookup)} max={2} />
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={s.empty}>
              <Ionicons name="construct-outline" size={40} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>
                {isFiltered ? 'No items match' : 'No items yet'}
              </Text>
              <Text style={s.emptyText}>
                {isFiltered
                  ? 'Try a different search, room or tag.'
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
                onPress={() => openLightbox(selected.image_url!)}
                accessibilityRole="imagebutton"
                accessibilityLabel={selected.name}
              >
                {/* Contained rather than cropped: a circle drawn round the
                    handle is no use if the crop cuts the handle off. */}
                <AnnotatedImage
                  uri={selected.image_url}
                  annotations={selected.image_annotations ?? []}
                  style={s.detailImage}
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
                {selected.location ? selectedZoneLabel : 'No location recorded'}
              </Text>
              {selectedFloor && (
                <Text style={s.detailFloor}>
                  · {selectedFloor === 'upstairs' ? 'Upstairs' : 'Downstairs'}
                </Text>
              )}
            </View>

            {selectedTags.length > 0 ? (
              <View style={s.detailTags}>
                <EquipmentTagChips tags={selectedTags} />
              </View>
            ) : null}

            {/* Go-find-it panel: what the spot looks like, plus where it sits
                in the building. */}
            {selected.location ? (
              <View style={s.locationCard}>
                {selectedZonePhoto ? (
                  <Pressable
                    onPress={() => openLightbox(selectedZonePhoto)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`Photo of ${selectedZoneLabel}`}
                    style={s.locationPhotoWrap}
                  >
                    <Image
                      source={selectedZonePhoto}
                      style={s.locationPhoto}
                      resizeMode="cover"
                    />
                    <Text style={s.locationCaption} numberOfLines={1}>
                      {selectedZoneLabel}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={[s.locationPhoto, s.locationPhotoPlaceholder]}>
                    <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                    <Text style={s.detailNoPhoto}>No photo for this location</Text>
                  </View>
                )}

                {selectedPlan ? (
                  <Pressable
                    onPress={() => openLightbox(selectedPlan)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`Floor plan showing ${selectedZoneLabel}`}
                    style={s.detailPlanWrap}
                  >
                    <Image
                      source={selectedPlan}
                      style={s.detailPlan}
                      resizeMode="contain"
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

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
        <>
          <EquipmentEditorModal
            visible={editorOpen}
            item={editorItem}
            onClose={() => setEditorOpen(false)}
          />
          <EquipmentTagManagerSheet
            visible={tagManagerOpen}
            onClose={() => setTagManagerOpen(false)}
          />
        </>
      )}

      {lightboxImages.length > 0 ? (
        <Lightbox
          images={lightboxImages}
          annotations={lightboxAnnotations}
          startIndex={lightboxIndex}
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
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
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
  thumbBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.bgPanel,
    alignItems: 'center',
    justifyContent: 'center',
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
  rowTags: {
    marginTop: 4,
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
    overflow: 'hidden',
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
  detailTags: {
    marginBottom: Spacing.md,
  },
  locationCard: {
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
  },
  locationPhotoWrap: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
  },
  locationPhoto: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.bgElevated,
  },
  locationPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  locationCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: 'rgba(10, 15, 26, 0.72)',
  },
  detailPlanWrap: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  detailPlan: {
    width: '100%',
    height: 320,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgPanel,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailEditRow: {
    marginTop: Spacing.md,
  },
});
