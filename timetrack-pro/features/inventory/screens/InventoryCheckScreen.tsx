import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, FlatList, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Lightbox from '@/components/ui/Lightbox';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useInventoryItems, useSubmitInventoryRun, useUploadCheckPhoto } from '../hooks';
import InventoryCheckCard from '../components/InventoryCheckCard';
import type { InventoryItem, InventoryStatus } from '../api';

// Local per-item run state (legacy inventoryRunChecks). Entries are created
// only by status/photo interactions — notes live in a separate map so that a
// note alone never marks an item as "touched" (legacy read notes from the DOM
// at submit time).
interface DraftCheck {
  status?: InventoryStatus;
  photo_url?: string | null;
}

export default function InventoryCheckScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: items, isLoading, isRefetching, refetch } = useInventoryItems(true);
  const submitRun = useSubmitInventoryRun();
  const uploadPhoto = useUploadCheckPhoto();

  const [checks, setChecks] = useState<Record<string, DraftCheck>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);

  // Prune drafts for items that no longer exist (deleted/deactivated by an
  // admin mid-run): a stale entry would fail the checks insert (FK) and
  // permanently wedge the photo guard. No-op while items are still loading.
  useEffect(() => {
    if (!items) return;
    const valid = new Set(items.map((i) => i.id));
    const prune = <T,>(prev: Record<string, T>): Record<string, T> => {
      const entries = Object.entries(prev).filter(([itemId]) => valid.has(itemId));
      return entries.length === Object.keys(prev).length
        ? prev
        : Object.fromEntries(entries);
    };
    setChecks(prune);
    setNotes(prune);
  }, [items]);

  const total = items?.length ?? 0;
  const readyCount = useMemo(
    () => Object.values(checks).filter((c) => c.status && c.photo_url).length,
    [checks],
  );
  const touchedAny = Object.keys(checks).length > 0;

  const setStatus = useCallback((itemId: string, status: InventoryStatus) => {
    setChecks((prev) => ({ ...prev, [itemId]: { ...prev[itemId], status } }));
  }, []);

  const setNote = useCallback((itemId: string, text: string) => {
    setNotes((prev) => ({ ...prev, [itemId]: text }));
  }, []);

  // Upload immediately on selection (legacy parity); Remove clears local
  // state only — uploaded files are never deleted here.
  const capturePhoto = useCallback(
    async (itemId: string, source: 'camera' | 'library') => {
      if (!user) return;
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          showToast('Camera permission is required to take a photo', 'error');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      }
      if (result.canceled || !result.assets?.length) return;
      setUploadingItemId(itemId);
      try {
        const asset = result.assets[0];
        const url = await uploadPhoto.mutateAsync({
          userId: user.id,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        });
        setChecks((prev) => ({
          ...prev,
          [itemId]: { ...prev[itemId], photo_url: url },
        }));
      } catch {
        // Error surfaced by the global mutation error toast.
      } finally {
        setUploadingItemId(null);
      }
    },
    [user, uploadPhoto, showToast],
  );

  const pickPhoto = useCallback(
    (itemId: string) => {
      Alert.alert('Add Photo', undefined, [
        { text: 'Take Photo', onPress: () => void capturePhoto(itemId, 'camera') },
        {
          text: 'Choose from Library',
          onPress: () => void capturePhoto(itemId, 'library'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [capturePhoto],
  );

  const removePhoto = useCallback((itemId: string) => {
    // Entry stays with photo_url null (legacy parity).
    setChecks((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], photo_url: null },
    }));
  }, []);

  const handleSubmit = async () => {
    if (!user) return;
    // Legacy guard: every touched item must have a photo (inventory.js:457-461).
    const missing = Object.entries(checks).filter(([, c]) => !c.photo_url);
    if (missing.length) {
      showToast('Every item requires a photo before submitting', 'error');
      return;
    }
    // One check per item WITH a status; status-less entries are skipped.
    const checkRows = Object.entries(checks)
      .filter(([, c]) => c.status)
      .map(([itemId, c]) => ({
        item_id: itemId,
        status: c.status!,
        notes: notes[itemId]?.trim() || null,
        photo_url: c.photo_url || null,
      }));
    try {
      await submitRun.mutateAsync({ userId: user.id, checks: checkRows });
      showToast('Inventory run submitted!');
      setChecks({});
      setNotes({});
    } catch {
      // Error surfaced by the global mutation error toast.
    }
  };

  const openLightbox = useCallback((url: string) => {
    // Always pass images as an array (fixes legacy single-image bug).
    setLightboxImages([url]);
  }, []);

  const submitTitle = submitRun.isPending
    ? 'Submitting...'
    : touchedAny
      ? `Submit Inventory Run (${readyCount}/${total})`
      : 'Submit Inventory Run';

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.header}>
          <Text style={s.heading}>Inventory Check</Text>
        </View>
        <View style={s.loading}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        <Text style={s.heading}>Inventory Check</Text>
      </View>

      {!items?.length ? (
        <EmptyState
          icon="\u{1F4E6}"
          title="No inventory items to check"
          message="Your admin hasn't added any inventory items yet."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListHeaderComponent={
            <View style={s.introPanel}>
              <Text style={s.introText}>
                Review each item below and set its status. When finished, submit the
                run.
              </Text>
              <Text style={s.progressText}>
                {readyCount} of {total} checked
              </Text>
              <Button
                title={submitTitle}
                onPress={handleSubmit}
                disabled={submitRun.isPending || readyCount < total || total === 0}
                fullWidth
              />
            </View>
          }
          renderItem={({ item }: { item: InventoryItem }) => (
            <InventoryCheckCard
              item={item}
              status={checks[item.id]?.status}
              notes={notes[item.id] ?? ''}
              photoUrl={checks[item.id]?.photo_url}
              uploading={uploadingItemId === item.id}
              onSetStatus={(status) => setStatus(item.id, status)}
              onChangeNotes={(text) => setNote(item.id, text)}
              onPickPhoto={() => pickPhoto(item.id)}
              onRemovePhoto={() => removePhoto(item.id)}
              onOpenImage={openLightbox}
            />
          )}
        />
      )}

      <Lightbox
        images={lightboxImages ?? []}
        visible={!!lightboxImages}
        onClose={() => setLightboxImages(null)}
      />
    </SafeAreaView>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  introPanel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  introText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  progressText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
});
