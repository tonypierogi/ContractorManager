import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Lightbox from '@/components/ui/Lightbox';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  LOCATION_ZONES,
  getLocationLabel,
  type Floor,
  type LocationZone,
} from '@/features/locations/zones';
import { formatDate, formatTime } from '@/utils/format';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import {
  useInventoryItems,
  useDeleteInventoryItem,
  useLastInventoryRun,
} from '../hooks';
import InventoryItemEditorModal from '../components/InventoryItemEditorModal';
import InventoryStatusBadge from '../components/InventoryStatusBadge';
import type { InventoryItem } from '../api';

type AdminTab = 'items' | 'last-run';

export default function InventoryAdminScreen() {
  const [activeTab, setActiveTab] = useState<AdminTab>('items');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [autoCamera, setAutoCamera] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);

  const openEditor = (item: InventoryItem | null) => {
    setEditingItem(item);
    setAutoCamera(false);
    setEditorVisible(true);
  };

  // Add flow is camera-first: the + button opens the camera, then name + location.
  const openAddFlow = () => {
    setEditingItem(null);
    setAutoCamera(true);
    setEditorVisible(true);
  };

  // Always pass images as an array (fixes legacy single-image lightbox bug).
  const openLightbox = (url: string) => setLightboxImages([url]);

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'items', label: 'Inventory Items' },
    { key: 'last-run', label: 'Last Run' },
  ];

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        <Text style={s.heading}>Inventory</Text>
      </View>

      <View style={s.panelContainer}>
        <View style={s.tabRow}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, activeTab === tab.key && s.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'items' ? (
          <ItemsTab onEdit={openEditor} onAdd={openAddFlow} onOpenImage={openLightbox} />
        ) : (
          <LastRunTab onOpenImage={openLightbox} />
        )}
      </View>

      {activeTab === 'items' ? (
        <TouchableOpacity
          style={s.fab}
          onPress={openAddFlow}
          activeOpacity={0.85}
          accessibilityLabel="Add item"
        >
          <Ionicons name="add" size={30} color={Colors.bgPrimary} />
        </TouchableOpacity>
      ) : null}

      <InventoryItemEditorModal
        visible={editorVisible}
        item={editingItem}
        autoLaunchCamera={autoCamera}
        onClose={() => setEditorVisible(false)}
      />

      <Lightbox
        images={lightboxImages ?? []}
        visible={!!lightboxImages}
        onClose={() => setLightboxImages(null)}
      />
    </SafeAreaView>
  );
}

function ItemsTab({
  onEdit,
  onAdd,
  onOpenImage,
}: {
  onEdit: (item: InventoryItem | null) => void;
  onAdd: () => void;
  onOpenImage: (url: string) => void;
}) {
  const { showToast } = useToast();
  const { data: items, isLoading, isError, refetch } = useInventoryItems(false);
  const deleteItem = useDeleteInventoryItem();

  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (locationFilter && item.location !== locationFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        getLocationLabel(item.location).toLowerCase().includes(q)
      );
    });
  }, [items, search, locationFilter]);

  const handleDelete = (item: InventoryItem) => {
    Alert.alert('Delete Item', `Delete "${item.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteItem.mutate(item.id, {
            onSuccess: () => showToast('Item deleted'),
          }),
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="⚠️"
        title="Failed to load inventory items"
        message="Check your connection and try again."
        action={{ label: 'Retry', onPress: () => refetch() }}
      />
    );
  }

  if (!items?.length) {
    return (
      <EmptyState
        icon="\u{1F4E6}"
        title="No inventory items yet"
        message="Add items your team needs to check during inventory runs."
        action={{ label: 'Add First Item', onPress: onAdd }}
      />
    );
  }

  return (
    <View style={s.itemsTab}>
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by item name or location"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[s.filterButton, locationFilter != null && s.filterButtonActive]}
          onPress={() => setFilterVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Filter by location"
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={locationFilter != null ? Colors.bgPrimary : Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {locationFilter != null ? (
        <View style={s.activeFilterRow}>
          <TouchableOpacity
            style={s.activeFilterChip}
            onPress={() => setLocationFilter(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={14} color={Colors.accent} />
            <Text style={s.activeFilterText}>{getLocationLabel(locationFilter)}</Text>
            <Ionicons name="close" size={14} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      ) : null}

      {filteredItems.length ? (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {filteredItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[s.itemCard, !item.is_active && s.itemCardInactive]}
              onPress={() => onEdit(item)}
              activeOpacity={0.7}
            >
              {item.image_url ? (
                <TouchableOpacity
                  onPress={() => onOpenImage(item.image_url!)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: item.image_url }}
                    style={s.itemThumb}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : (
                <View style={s.itemThumbPlaceholder}>
                  <Ionicons name="cube-outline" size={24} color={Colors.textMuted} />
                </View>
              )}
              <View style={s.itemInfo}>
                <View style={s.itemTitleRow}>
                  <Text style={s.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.location ? (
                    <View style={s.locationPill}>
                      <Text style={s.locationPillText} numberOfLines={1}>
                        {getLocationLabel(item.location)}
                      </Text>
                    </View>
                  ) : (
                    <View style={[s.locationPill, s.locationPillMissing]}>
                      <Text style={s.locationPillMissingText}>No zone</Text>
                    </View>
                  )}
                </View>
                {item.description ? (
                  <Text style={s.itemDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                {!item.is_active ? (
                  <View style={s.inactiveBadge}>
                    <Badge label="Inactive" variant="default" />
                  </View>
                ) : null}
              </View>
              <TouchableOpacity
                style={s.deleteButton}
                onPress={() => handleDelete(item)}
                hitSlop={8}
                accessibilityLabel={`Delete ${item.name}`}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <EmptyState
          icon="\u{1F50D}"
          title="No matching items"
          message={
            locationFilter
              ? `Nothing ${search ? 'matching your search ' : ''}in ${getLocationLabel(locationFilter)}.`
              : 'Try a different search.'
          }
        />
      )}

      <Modal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        title="Filter by Location"
        size="sm"
      >
        <TouchableOpacity
          style={s.filterOption}
          onPress={() => {
            setLocationFilter(null);
            setFilterVisible(false);
          }}
          activeOpacity={0.7}
        >
          <Text style={s.filterOptionText}>All locations</Text>
          {locationFilter == null && (
            <Ionicons name="checkmark" size={18} color={Colors.accent} />
          )}
        </TouchableOpacity>
        {(Object.entries(LOCATION_ZONES) as [Floor, LocationZone[]][]).map(
          ([floor, zones]) => (
            <View key={floor}>
              <Text style={s.filterGroupHeader}>
                {floor.charAt(0).toUpperCase() + floor.slice(1)}
              </Text>
              {zones.map((zone) => (
                <TouchableOpacity
                  key={zone.id}
                  style={s.filterOption}
                  onPress={() => {
                    setLocationFilter(zone.id);
                    setFilterVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={s.filterOptionText}>{zone.label}</Text>
                  {locationFilter === zone.id && (
                    <Ionicons name="checkmark" size={18} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}
      </Modal>
    </View>
  );
}

function LastRunTab({ onOpenImage }: { onOpenImage: (url: string) => void }) {
  const { data, isLoading } = useLastInventoryRun();

  if (isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon="\u{1F4CB}"
        title="No inventory runs yet"
        message="Your team hasn't completed an inventory check yet."
      />
    );
  }

  const { run, runnerName, checks } = data;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
      <View style={s.runSummary}>
        <Text style={s.runTitle}>Last Inventory Run</Text>
        <Text style={s.runBy}>
          By <Text style={s.runByName}>{runnerName}</Text> on{' '}
          {formatDate(run.started_at)} at {formatTime(run.started_at)}
        </Text>
        <View style={s.runBadgeRow}>
          <Badge
            label={run.completed_at ? 'Completed' : 'In Progress'}
            variant={run.completed_at ? 'success' : 'warning'}
          />
        </View>
        {run.notes ? <Text style={s.runNotes}>{run.notes}</Text> : null}
      </View>

      {checks.length ? (
        checks.map((check) => (
          <View key={check.id} style={s.checkCard}>
            <View style={s.checkHeader}>
              {check.inventory_items?.image_url ? (
                <TouchableOpacity
                  onPress={() => onOpenImage(check.inventory_items!.image_url!)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: check.inventory_items.image_url }}
                    style={s.checkThumb}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : null}
              <View style={s.checkInfo}>
                <Text style={s.checkName} numberOfLines={1}>
                  {check.inventory_items?.name || 'Unknown Item'}
                </Text>
                {check.inventory_items?.location ? (
                  <Text style={s.checkLocation} numberOfLines={1}>
                    {getLocationLabel(check.inventory_items.location)}
                  </Text>
                ) : null}
              </View>
              <InventoryStatusBadge status={check.status} />
            </View>
            {check.notes ? <Text style={s.checkNotes}>{check.notes}</Text> : null}
            {check.photo_url ? (
              <TouchableOpacity
                onPress={() => onOpenImage(check.photo_url!)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: check.photo_url }}
                  style={s.checkPhoto}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={s.noChecksText}>No items checked in this run.</Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  panelContainer: {
    flex: 1,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
  },
  tabActive: {
    backgroundColor: Colors.accent,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.bgPrimary,
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  itemsTab: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  activeFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accentGlow,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
  },
  activeFilterText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 4,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  filterOptionText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  filterGroupHeader: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg + Spacing.sm,
    bottom: Spacing.lg + Spacing.sm,
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  itemCardInactive: {
    opacity: 0.6,
  },
  itemThumb: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  itemThumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  locationPill: {
    backgroundColor: Colors.accentGlow,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    maxWidth: 130,
  },
  locationPillText: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.accent,
  },
  locationPillMissing: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  locationPillMissingText: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.danger,
  },
  itemDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  inactiveBadge: {
    marginTop: Spacing.xs,
  },
  deleteButton: {
    alignSelf: 'center',
    padding: Spacing.xs,
  },
  runSummary: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  runTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  runBy: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  runByName: {
    fontWeight: '700',
    color: Colors.text,
  },
  runBadgeRow: {
    marginTop: Spacing.sm,
  },
  runNotes: {
    fontSize: FontSize.sm,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  checkCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkThumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  checkInfo: {
    flex: 1,
  },
  checkName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  checkLocation: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkNotes: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  checkPhoto: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgElevated,
  },
  noChecksText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    padding: Spacing.lg,
  },
});
