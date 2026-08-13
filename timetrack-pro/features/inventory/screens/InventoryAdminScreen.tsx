import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Lightbox from '@/components/ui/Lightbox';
import { useToast } from '@/components/ui/Toast';
import { getLocationLabel } from '@/features/locations/zones';
import { formatDate, formatTime } from '@/utils/format';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
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
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);

  const openEditor = (item: InventoryItem | null) => {
    setEditingItem(item);
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
        <Button title="+ Add Item" size="sm" onPress={() => openEditor(null)} />
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
          <ItemsTab onEdit={openEditor} onOpenImage={openLightbox} />
        ) : (
          <LastRunTab onOpenImage={openLightbox} />
        )}
      </View>

      <InventoryItemEditorModal
        visible={editorVisible}
        item={editingItem}
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
  onOpenImage,
}: {
  onEdit: (item: InventoryItem | null) => void;
  onOpenImage: (url: string) => void;
}) {
  const { showToast } = useToast();
  const { data: items, isLoading, isError, refetch } = useInventoryItems(false);
  const deleteItem = useDeleteInventoryItem();

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
        action={{ label: 'Add First Item', onPress: () => onEdit(null) }}
      />
    );
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
      {items.map((item) => (
        <View key={item.id} style={[s.itemCard, !item.is_active && s.itemCardInactive]}>
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
            <Text style={s.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.location ? (
              <Text style={s.itemLocation} numberOfLines={1}>
                {getLocationLabel(item.location)}
              </Text>
            ) : (
              <Text style={s.itemNoZone} numberOfLines={1}>
                No zone — edit to assign one
              </Text>
            )}
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
            <View style={s.itemActions}>
              <Button
                title="Edit"
                variant="secondary"
                size="sm"
                onPress={() => onEdit(item)}
              />
              <Button
                title="Delete"
                variant="danger"
                size="sm"
                onPress={() => handleDelete(item)}
              />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
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
  itemName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  itemLocation: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemNoZone: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.danger,
    marginTop: 2,
  },
  itemDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  inactiveBadge: {
    marginTop: Spacing.xs,
  },
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
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
