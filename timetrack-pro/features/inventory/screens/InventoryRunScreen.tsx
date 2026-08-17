import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import AppModal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/auth-provider';
import {
  ALL_ZONES,
  FLOOR_PLAN_ASPECT,
  FLOOR_PLAN_HIGHLIGHT,
  ZONE_PHOTOS,
  getLocationLabel,
  zoneFloor,
} from '@/features/locations/zones';
import { formatDate } from '@/utils/format';
import { pickPhotoAsset, type PhotoSource } from '@/lib/photo-picker';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import {
  useInventoryItems,
  useLatestItemChecks,
  useSubmitInventoryRun,
  useUploadCheckPhoto,
} from '../hooks';
import {
  loadRunDraft,
  saveRunDraft,
  clearRunDraft,
  type DraftCheck,
  type RunDraft,
} from '../run-draft';
import type { InventoryItem, InventoryStatus } from '../api';

const STATUSES: InventoryStatus[] = ['Plenty', 'Some', 'OUT'];

const STATUS_COLORS: Record<InventoryStatus, string> = {
  Plenty: Colors.success,
  Some: Colors.warning,
  OUT: Colors.danger,
};

const STATUS_FILLS: Record<InventoryStatus, string> = {
  Plenty: 'rgba(16, 185, 129, 0.15)',
  Some: 'rgba(245, 158, 11, 0.15)',
  OUT: 'rgba(244, 63, 94, 0.15)',
};

const STATUS_TINTS: Record<InventoryStatus, string> = {
  Plenty: 'rgba(16, 185, 129, 0.06)',
  Some: 'rgba(245, 158, 11, 0.06)',
  OUT: 'rgba(244, 63, 94, 0.06)',
};

interface ZoneGroup {
  id: string;
  label: string;
  items: InventoryItem[];
}

/**
 * Camera-first inventory run. Zones (walk order = LOCATION_ZONES order) →
 * per-zone item list → tap an item to snap a photo → status sheet → back to
 * the list with the row checked. The draft persists to AsyncStorage after
 * every check so an interrupted run resumes from the home screen.
 */
export default function InventoryRunScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: items, isLoading } = useInventoryItems(true);
  const { data: lastChecks } = useLatestItemChecks();
  const submitRun = useSubmitInventoryRun();
  const uploadPhoto = useUploadCheckPhoto();

  const [draft, setDraft] = useState<RunDraft | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [sheetItem, setSheetItem] = useState<InventoryItem | null>(null);
  const [sheetNote, setSheetNote] = useState('');
  const [sheetUploading, setSheetUploading] = useState(false);
  // Camera-first run flow, but the sheet lets you switch to the library.
  const [photoSource, setPhotoSource] = useState<PhotoSource>('camera');
  const [zoneMapVisible, setZoneMapVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    void loadRunDraft(user.id).then((existing) => {
      setDraft(existing ?? { startedAt: new Date().toISOString(), checks: {} });
    });
  }, [user]);

  // Prune draft entries for items an admin deleted/deactivated mid-run — a
  // stale entry would fail the checks insert (FK) at submit.
  useEffect(() => {
    if (!items || !draft || !user) return;
    const valid = new Set(items.map((i) => i.id));
    const entries = Object.entries(draft.checks).filter(([id]) => valid.has(id));
    if (entries.length !== Object.keys(draft.checks).length) {
      const next = { ...draft, checks: Object.fromEntries(entries) };
      setDraft(next);
      void saveRunDraft(user.id, next);
    }
  }, [items, draft, user]);

  const zones = useMemo<ZoneGroup[]>(
    () =>
      ALL_ZONES.map((z) => ({
        id: z.id,
        label: z.label,
        items: (items ?? []).filter((i) => i.location === z.id),
      })).filter((z) => z.items.length > 0),
    [items],
  );

  // Zones are mandatory; anything unzoned is an admin data problem we
  // surface loudly rather than hiding — but it can't block the run.
  const unzonedCount = useMemo(
    () =>
      (items ?? []).filter(
        (i) => !i.location || !ALL_ZONES.some((z) => z.id === i.location),
      ).length,
    [items],
  );

  const zonedItems = useMemo(() => zones.flatMap((z) => z.items), [zones]);
  const total = zonedItems.length;
  const checkedCount = draft
    ? zonedItems.filter((i) => draft.checks[i.id]).length
    : 0;
  const allChecked = total > 0 && checkedCount === total;

  const activeZone = zoneId ? zones.find((z) => z.id === zoneId) : null;

  const zoneChecked = useCallback(
    (zone: ZoneGroup) => zone.items.filter((i) => draft?.checks[i.id]).length,
    [draft],
  );

  const openSheet = useCallback(
    (item: InventoryItem) => {
      setSheetNote(draft?.checks[item.id]?.notes ?? '');
      setSheetItem(item);
    },
    [draft],
  );

  const closeSheet = useCallback(() => {
    setSheetItem(null);
    setSheetNote('');
    setSheetUploading(false);
    setPhotoSource('camera');
  }, []);

  // Take (or upload) the proof photo and store it; resolves null when the user
  // cancels or the upload fails (the sheet stays open so they can retry).
  const capturePhoto = useCallback(
    async (source: PhotoSource): Promise<string | null> => {
      if (!user) return null;
      const asset = await pickPhotoAsset(source, {
        onCameraDenied: () =>
          showToast('Camera access denied — upload from your library instead', 'error'),
      });
      if (!asset) return null;
      setSheetUploading(true);
      try {
        return await uploadPhoto.mutateAsync({
          userId: user.id,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        });
      } catch {
        // Error surfaced by the global mutation error toast.
        return null;
      } finally {
        setSheetUploading(false);
      }
    },
    [user, uploadPhoto, showToast],
  );

  const commit = useCallback(
    (item: InventoryItem, status: InventoryStatus, photoUrl: string, notes: string) => {
      if (!draft || !user) return;
      const next: RunDraft = {
        ...draft,
        checks: {
          ...draft.checks,
          [item.id]: {
            status,
            photo_url: photoUrl,
            notes: notes.trim() || undefined,
          },
        },
      };
      setDraft(next);
      void saveRunDraft(user.id, next);
      const zone = zones.find((z) => z.id === item.location);
      const zoneDone = zone?.items.every((i) => next.checks[i.id]) ?? false;
      closeSheet();
      if (zoneDone) setZoneId(null);
    },
    [draft, user, zones, closeSheet],
  );

  // Status tap: fresh checks go to the camera (or the library, if that's the
  // selected source) for proof, then save; already-checked items just update
  // their status in place.
  const selectStatus = useCallback(
    async (status: InventoryStatus) => {
      if (!sheetItem || !draft) return;
      const existing = draft.checks[sheetItem.id];
      if (existing) {
        commit(sheetItem, status, existing.photo_url, sheetNote);
        return;
      }
      const url = await capturePhoto(photoSource);
      if (!url) return;
      commit(sheetItem, status, url, sheetNote);
    },
    [sheetItem, draft, sheetNote, commit, capturePhoto, photoSource],
  );

  const replacePhoto = useCallback(
    async (source: PhotoSource) => {
      if (!sheetItem || !draft) return;
      const existing = draft.checks[sheetItem.id];
      if (!existing) return;
      const url = await capturePhoto(source);
      if (!url) return;
      commit(sheetItem, existing.status, url, sheetNote);
    },
    [sheetItem, draft, sheetNote, capturePhoto, commit],
  );

  const handleSubmit = useCallback(async () => {
    if (!user || !draft) return;
    const rows = Object.entries(draft.checks).map(([item_id, c]) => ({
      item_id,
      status: c.status,
      notes: c.notes ?? null,
      photo_url: c.photo_url,
    }));
    try {
      await submitRun.mutateAsync({ userId: user.id, checks: rows });
      await clearRunDraft(user.id);
      showToast('Inventory run submitted!');
      router.back();
    } catch {
      // Error surfaced by the global mutation error toast.
    }
  }, [user, draft, submitRun, showToast]);

  const confirmDiscard = useCallback(() => {
    const discard = async () => {
      if (user) await clearRunDraft(user.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      // RN-web Alert is a no-op; use the browser confirm dialog.
      if ((globalThis as any).confirm?.('Discard this run? All checks will be lost.')) {
        void discard();
      }
      return;
    }
    Alert.alert('Discard run?', 'All checks in this run will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => void discard() },
    ]);
  }, [user]);

  if (isLoading || !draft) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.loading}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!total) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <EmptyState
          icon="\u{1F4E6}"
          title="No inventory items to check"
          message="Your admin hasn't added any zoned inventory items yet."
          action={{ label: 'Back', onPress: () => router.back() }}
        />
      </SafeAreaView>
    );
  }

  const progressPct = total ? Math.round((checkedCount / total) * 100) : 0;

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => (activeZone ? setZoneId(null) : router.back())}
          hitSlop={8}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.heading} numberOfLines={1}>
            {activeZone ? activeZone.label : 'Inventory Run'}
          </Text>
          <Text style={s.headerSub}>
            {activeZone
              ? `${zoneChecked(activeZone)} of ${activeZone.items.length} checked`
              : `${checkedCount} of ${total} checked`}
          </Text>
        </View>
        {activeZone ? (
          <TouchableOpacity
            onPress={() => setZoneMapVisible(true)}
            hitSlop={8}
            style={[s.backBtn, s.mapBtn]}
            accessibilityLabel="Show zone on floor plan"
          >
            <Ionicons name="map-outline" size={20} color={Colors.accent} />
          </TouchableOpacity>
        ) : (
          <View style={s.backBtn} />
        )}
      </View>

      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progressPct}%` }]} />
      </View>

      {activeZone ? (
        <ZoneItemsView
          zone={activeZone}
          draft={draft}
          lastChecks={lastChecks}
          onOpen={openSheet}
        />
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {unzonedCount > 0 ? (
            <View style={s.warnBanner}>
              <Ionicons name="warning-outline" size={16} color={Colors.warning} />
              <Text style={s.warnText}>
                {unzonedCount} item{unzonedCount === 1 ? '' : 's'} without a zone
                {' '}aren't in this run — ask an admin to assign zones.
              </Text>
            </View>
          ) : null}

          {zones.map((zone) => {
            const done = zoneChecked(zone);
            const complete = done === zone.items.length;
            return (
              <TouchableOpacity
                key={zone.id}
                style={[s.zoneRow, complete && s.zoneRowComplete]}
                onPress={() => setZoneId(zone.id)}
                activeOpacity={0.7}
              >
                <Text style={[s.zoneLabel, complete && { color: Colors.success }]}>
                  {zone.label}
                </Text>
                <View style={s.zoneRight}>
                  <Text
                    style={[s.zoneCount, complete && { color: Colors.success }]}
                  >
                    {done}/{zone.items.length}
                  </Text>
                  <Ionicons
                    name={complete ? 'checkmark-circle' : 'chevron-forward'}
                    size={18}
                    color={complete ? Colors.success : Colors.textMuted}
                  />
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={s.footer}>
            <Button
              title={
                submitRun.isPending
                  ? 'Submitting...'
                  : `Submit Run (${checkedCount}/${total})`
              }
              onPress={handleSubmit}
              disabled={!allChecked || submitRun.isPending}
              fullWidth
            />
            <Button
              title="Discard Run"
              variant="ghost"
              onPress={confirmDiscard}
              fullWidth
            />
          </View>
        </ScrollView>
      )}

      <StatusSheet
        item={sheetItem}
        check={sheetItem ? draft.checks[sheetItem.id] : undefined}
        lastCheck={sheetItem ? lastChecks?.[sheetItem.id] : undefined}
        note={sheetNote}
        uploading={sheetUploading}
        photoSource={photoSource}
        onChangePhotoSource={setPhotoSource}
        onChangeNote={setSheetNote}
        onSelect={selectStatus}
        onReplacePhoto={replacePhoto}
        onClose={closeSheet}
      />

      <ZoneMapModal
        zone={zoneMapVisible ? activeZone ?? null : null}
        onClose={() => setZoneMapVisible(false)}
      />
    </SafeAreaView>
  );
}

function ZoneMapModal({
  zone,
  onClose,
}: {
  zone: ZoneGroup | null;
  onClose: () => void;
}) {
  const floor = zone ? zoneFloor(zone.id) : null;
  const plan = zone ? FLOOR_PLAN_HIGHLIGHT[zone.id] : undefined;
  const photo = zone ? ZONE_PHOTOS[zone.id] : undefined;

  return (
    <AppModal visible={!!zone} onClose={onClose} title={zone?.label ?? ''} size="sm">
      {plan && floor ? (
        <Image
          source={plan}
          style={[s.mapPlan, { aspectRatio: FLOOR_PLAN_ASPECT[floor] }]}
          resizeMode="contain"
        />
      ) : null}
      {photo ? <Image source={photo} style={s.mapPhoto} resizeMode="cover" /> : null}
      {!plan && !photo ? (
        <Text style={s.mapEmpty}>No map available for this zone.</Text>
      ) : null}
    </AppModal>
  );
}

function ZoneItemsView({
  zone,
  draft,
  lastChecks,
  onOpen,
}: {
  zone: ZoneGroup;
  draft: RunDraft;
  lastChecks: Record<string, { status: InventoryStatus; checked_at: string }> | undefined;
  onOpen: (item: InventoryItem) => void;
}) {
  const nextItem = zone.items.find((i) => !draft.checks[i.id]);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
      {zone.items.map((item) => {
        const check = draft.checks[item.id];
        const last = lastChecks?.[item.id];
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              s.itemRow,
              check && {
                backgroundColor: STATUS_TINTS[check.status],
                borderColor: STATUS_COLORS[check.status],
              },
            ]}
            onPress={() => onOpen(item)}
            activeOpacity={0.7}
          >
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={s.itemThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={s.itemThumbPlaceholder}>
                <Ionicons name="cube-outline" size={18} color={Colors.textMuted} />
              </View>
            )}
            <View style={s.itemInfo}>
              <Text style={s.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              {check ? (
                <Text style={[s.itemSub, { color: STATUS_COLORS[check.status] }]}>
                  {check.status}
                  {check.notes ? ` · ${check.notes}` : ''}
                </Text>
              ) : last ? (
                <Text style={s.itemSub}>
                  Last: {last.status} · {formatDate(last.checked_at)}
                </Text>
              ) : (
                <Text style={s.itemSub}>Not checked before</Text>
              )}
            </View>
            {check ? (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={STATUS_COLORS[check.status]}
              />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        );
      })}

      {nextItem ? (
        <View style={s.footer}>
          <Button
            title={`Check Next Item (${nextItem.name})`}
            onPress={() => onOpen(nextItem)}
            fullWidth
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function StatusSheet({
  item,
  check,
  lastCheck,
  note,
  uploading,
  photoSource,
  onChangePhotoSource,
  onChangeNote,
  onSelect,
  onReplacePhoto,
  onClose,
}: {
  item: InventoryItem | null;
  check: DraftCheck | undefined;
  lastCheck: { status: InventoryStatus; checked_at: string } | undefined;
  note: string;
  uploading: boolean;
  photoSource: PhotoSource;
  onChangePhotoSource: (source: PhotoSource) => void;
  onChangeNote: (text: string) => void;
  onSelect: (status: InventoryStatus) => void;
  onReplacePhoto: (source: PhotoSource) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!item}
      transparent
      animationType="slide"
      onRequestClose={uploading ? () => {} : onClose}
    >
      <KeyboardAvoidingView
        style={s.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.sheetBackdrop} onPress={uploading ? undefined : onClose} />
        <View style={s.sheetPanel}>
          <View style={s.sheetHandle} />

          {item?.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={s.refImage}
              resizeMode="cover"
            />
          ) : (
            <View style={s.refImagePlaceholder}>
              <Ionicons name="cube-outline" size={28} color={Colors.textMuted} />
              <Text style={s.refPlaceholderText}>No reference photo</Text>
            </View>
          )}

          <Text style={s.sheetTitle} numberOfLines={1}>
            {item?.name}
          </Text>
          <Text style={s.sheetSub} numberOfLines={1}>
            {getLocationLabel(item?.location)}
            {lastCheck
              ? ` · Last: ${lastCheck.status}, ${formatDate(lastCheck.checked_at)}`
              : ' · Not checked before'}
          </Text>
          {item?.description ? (
            <Text style={s.sheetDesc}>{item.description}</Text>
          ) : null}

          {check ? (
            <View style={s.capturedRow}>
              <Image
                source={{ uri: check.photo_url }}
                style={s.capturedThumb}
                resizeMode="cover"
              />
              <Text style={s.capturedText}>Your photo from this run</Text>
              <View style={s.capturedActions}>
                <Button
                  title="Retake"
                  variant="secondary"
                  size="sm"
                  onPress={() => void onReplacePhoto('camera')}
                  disabled={uploading}
                />
                <Button
                  title="Upload"
                  variant="secondary"
                  size="sm"
                  onPress={() => void onReplacePhoto('library')}
                  disabled={uploading}
                />
              </View>
            </View>
          ) : null}

          <TextInput
            style={s.sheetNoteInput}
            value={note}
            onChangeText={onChangeNote}
            placeholder="Note (optional) — saved with the status"
            placeholderTextColor={Colors.textMuted}
            editable={!uploading}
          />

          {uploading ? (
            <View style={s.uploadingRow}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={s.uploadingText}>Uploading photo…</Text>
            </View>
          ) : (
            <>
              {!check ? (
                <View style={s.sourceRow}>
                  {(['camera', 'library'] as const).map((source) => {
                    const active = photoSource === source;
                    return (
                      <TouchableOpacity
                        key={source}
                        style={[s.sourceBtn, active && s.sourceBtnActive]}
                        onPress={() => onChangePhotoSource(source)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Ionicons
                          name={source === 'camera' ? 'camera' : 'image-outline'}
                          size={16}
                          color={active ? Colors.accent : Colors.textSecondary}
                        />
                        <Text style={[s.sourceText, active && s.sourceTextActive]}>
                          {source === 'camera' ? 'Take photo' : 'Upload photo'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
              <View style={s.sheetStatusRow}>
                {STATUSES.map((status) => {
                  const active = check?.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[
                        s.sheetStatusBtn,
                        {
                          backgroundColor: STATUS_FILLS[status],
                          borderColor: active ? STATUS_COLORS[status] : 'transparent',
                        },
                      ]}
                      onPress={() => void onSelect(status)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[s.sheetStatusText, { color: STATUS_COLORS[status] }]}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!check ? (
                <Text style={s.sheetHint}>
                  {photoSource === 'camera'
                    ? 'Pick a status — the camera opens to snap proof.'
                    : 'Pick a status — your photo library opens for the proof shot.'}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  mapBtn: {
    alignItems: 'flex-end',
  },
  mapPlan: {
    width: 150,
    alignSelf: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    marginBottom: Spacing.md,
  },
  mapPhoto: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  mapEmpty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    padding: Spacing.lg,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  heading: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: 2,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  warnText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.warning,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: 52,
    marginBottom: Spacing.sm,
  },
  zoneRowComplete: {
    backgroundColor: STATUS_TINTS.Plenty,
    borderColor: Colors.success,
  },
  zoneLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  zoneRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  zoneCount: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  footer: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: 60,
    marginBottom: Spacing.sm,
  },
  itemThumb: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  itemThumbPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
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
  itemSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 26, 0.7)',
  },
  sheetPanel: {
    backgroundColor: Colors.bgPanel,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  refImage: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    marginBottom: Spacing.md,
  },
  refImagePlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  refPlaceholderText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  sheetSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sheetDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  capturedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  capturedThumb: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  capturedText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  capturedActions: {
    gap: Spacing.xs,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
  },
  sourceBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.bgElevated,
  },
  sourceText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sourceTextActive: {
    color: Colors.accent,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
  },
  uploadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  sheetHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  sheetStatusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sheetStatusBtn: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  sheetStatusText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  sheetNoteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.sm,
    color: Colors.text,
    backgroundColor: Colors.bgSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    minHeight: 44,
  },
});
