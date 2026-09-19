import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Lightbox from '@/components/ui/Lightbox';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/auth-provider';
import LayoutCanvas from '@/features/layouts/components/LayoutCanvas';
import LayoutSettingsModal, {
  type LayoutSettings,
} from '@/features/layouts/components/LayoutSettingsModal';
import FurniturePickerSheet from '@/features/layouts/components/FurniturePickerSheet';
import FurnitureEditorModal from '@/features/layouts/components/FurnitureEditorModal';
import PieceSwatch from '@/features/layouts/components/PieceSwatch';
import { LayoutsNotSetUpError } from '@/features/layouts/api';
import {
  useDeleteFloorLayout,
  useFloorLayout,
  useFurniturePieces,
  usePlanScales,
  useSaveFloorLayout,
} from '@/features/layouts/hooks';
import {
  ROTATE_STEP,
  floorLabel,
  layoutPlace,
  zoneOutline,
  clampToRoom,
  countPieces,
  describePiece,
  formatInches,
  newItemId,
  normalizeRotation,
  pieceCountLabel,
  rotatedExtents,
} from '@/features/layouts/geometry';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { FloorLayout, FloorLayoutItem, FurniturePiece } from '@/types/database';

interface Draft extends LayoutSettings {
  items: FloorLayoutItem[];
}

/** Matches LayoutCanvas's ruler gutter, for turning scroll offsets into plan positions. */
const RULER = 18;

/** How far one tap of an arrow moves a piece. */
const NUDGE_IN = 6;
/** Breathing room left between a copied piece and the one it came from. */
const COPY_GAP_IN = 6;

/**
 * One saved layout: furniture drawn to scale on top of its floor plan. Admins
 * drag, rotate, copy and label pieces and save the result; crews get the same
 * plan read-only, and can tap a piece for the gap to its nearest neighbour.
 *
 * The plan is shown full width and scrolls, so furniture stays big enough to
 * grab on a phone; it opens scrolled to the layout's room (or its furniture).
 *
 * Edits stay in a local draft until Save, so a stray drag never changes what
 * the crew sees.
 */
export default function FloorLayoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAuth();
  const canEdit = role === 'admin';
  // Admins can browse in the contractor view too; stay on whichever side
  // they came in from when leaving or opening a copy.
  const basePath = useSegments()[0] === '(employee)' ? '/(employee)/venue' : '/(admin)/locations';
  const { showToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 900;

  const layoutQuery = useFloorLayout(id);
  const piecesQuery = useFurniturePieces();
  const { scales, isLoading: scalesLoading, error: scalesError } = usePlanScales();
  const saveLayout = useSaveFloorLayout();
  const deleteLayout = useDeleteFloorLayout();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [droppedCount, setDroppedCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasBox, setCanvasBox] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const canvasScroll = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pieceEditorOpen, setPieceEditorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copying, setCopying] = useState(false);
  const [photoOpen, setPhotoOpen] = useState<string | null>(null);

  const pieces = piecesQuery.data;
  const pieceMap = useMemo(
    () => new Map((pieces ?? []).map((piece) => [piece.id, piece])),
    [pieces],
  );

  // Seed the draft once the layout and the library are in, and again if the
  // saved layout changes underneath a clean draft (another admin saved).
  const layout = layoutQuery.data;
  useEffect(() => {
    if (!layout || !pieces || dirty) return;
    const known = new Set(pieces.map((piece) => piece.id));
    const items = layout.items.filter((item) => known.has(item.piece_id));
    setDroppedCount(layout.items.length - items.length);
    setDraft(toDraft(layout, items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout?.id, layout?.updated_at, pieces]);

  // The floor's real size. Positions are stored as fractions of the plan, so
  // everything measured in inches goes through these two numbers.
  const scale = draft ? scales[draft.floor] : null;
  const planWIn = scale?.widthIn ?? 1;
  const planHIn = scale?.depthIn ?? 1;

  /** Pull a placement back onto the plan, whole piece included. */
  const clampItem = useCallback(
    (item: FloorLayoutItem, piece: FurniturePiece): FloorLayoutItem => {
      if (!scale) return item;
      const pos = clampToRoom(
        item.x * scale.widthIn,
        item.y * scale.depthIn,
        piece,
        item.rotation,
        scale.widthIn,
        scale.depthIn,
      );
      return { ...item, x: pos.x / scale.widthIn, y: pos.y / scale.depthIn };
    },
    [scale],
  );

  const hubHref = `${basePath}?tab=layouts`;
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(hubHref as any);
  }, [hubHref]);

  const requestLeave = () => {
    if (dirty) setConfirmLeave(true);
    else leave();
  };

  // The browser's own "leave site?" prompt for a tab close or reload.
  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty || typeof window === 'undefined') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const edit = useCallback((change: (d: Draft) => Draft) => {
    setDraft((d) => (d ? change(d) : d));
    setDirty(true);
  }, []);

  /** Apply `change` to one placement and pull it back onto the plan. */
  const editItem = useCallback(
    (itemId: string, change: (item: FloorLayoutItem) => FloorLayoutItem) => {
      edit((d) => ({
        ...d,
        items: d.items.map((item) => {
          if (item.id !== itemId) return item;
          const next = change(item);
          const piece = pieceMap.get(next.piece_id);
          return piece ? clampItem(next, piece) : next;
        }),
      }));
    },
    [edit, pieceMap, clampItem],
  );

  const handleMove = useCallback(
    (itemId: string, x: number, y: number) => editItem(itemId, (item) => ({ ...item, x, y })),
    [editItem],
  );

  const selected = draft?.items.find((item) => item.id === selectedId) ?? null;
  const selectedPiece = selected ? pieceMap.get(selected.piece_id) ?? null : null;

  const rotateSelected = (delta: number) => {
    if (!selected) return;
    editItem(selected.id, (item) => ({ ...item, rotation: normalizeRotation(item.rotation + delta) }));
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selected) return;
    editItem(selected.id, (item) => ({ ...item, x: item.x + dx / planWIn, y: item.y + dy / planHIn }));
  };

  /** Mirror left-to-right — turns an L sectional to face the other way. */
  const flipSelected = () => {
    if (!selected) return;
    editItem(selected.id, (item) => ({ ...item, flip: !item.flip }));
  };

  const removeSelected = () => {
    if (!selected) return;
    edit((d) => ({ ...d, items: d.items.filter((item) => item.id !== selected.id) }));
    setSelectedId(null);
  };

  /**
   * Drop `piece` with its centre at (xIn, yIn) inches on the plan, stepping
   * right (then down) past anything already sitting there.
   */
  const place = (piece: FurniturePiece, xIn: number, yIn: number, rotation: number, label: string | null) => {
    if (!draft || !scale) return;
    const W = scale.widthIn;
    const H = scale.depthIn;
    const { halfW, halfH } = rotatedExtents(piece.width_in, piece.depth_in, rotation, piece.shape);
    const taken = (px: number, py: number) =>
      draft.items.some((item) => Math.abs(item.x * W - px) < 2 && Math.abs(item.y * H - py) < 2);
    let pos = clampToRoom(xIn, yIn, piece, rotation, W, H);
    for (let i = 0; i < 40 && taken(pos.x, pos.y); i++) {
      const right = clampToRoom(pos.x + halfW * 2 + COPY_GAP_IN, pos.y, piece, rotation, W, H);
      pos = right.x !== pos.x
        ? right
        : clampToRoom(xIn, pos.y + halfH * 2 + COPY_GAP_IN, piece, rotation, W, H);
    }
    const item: FloorLayoutItem = { id: newItemId(), piece_id: piece.id, x: pos.x / W, y: pos.y / H, rotation, label };
    edit((d) => ({ ...d, items: [...d.items, item] }));
    setSelectedId(item.id);
  };

  // The plan's size on screen — the canvas fits the width and scrolls.
  const canvasW = Math.max(0, Math.min(canvasBox.width - Spacing.md * 2, 760));
  const planPxW = Math.max(1, canvasW - RULER);
  const planPxH = (planPxW / planWIn) * planHIn;

  /** The middle of the part of the plan on screen, in inches: where new pieces land. */
  const visibleCenter = () => {
    const yPx = scrollY.current + canvasBox.height / 2 - Spacing.md - RULER;
    const yFrac = Math.min(1, Math.max(0, yPx / planPxH));
    return { xIn: planWIn / 2, yIn: yFrac * planHIn };
  };

  const addPiece = (piece: FurniturePiece) => {
    setPickerOpen(false);
    const c = visibleCenter();
    place(piece, c.xIn, c.yIn, 0, null);
  };

  const copySelected = () => {
    if (!selected || !selectedPiece) return;
    const { halfW } = rotatedExtents(selectedPiece.width_in, selectedPiece.depth_in, selected.rotation, selectedPiece.shape);
    place(
      selectedPiece,
      selected.x * planWIn + halfW * 2 + COPY_GAP_IN,
      selected.y * planHIn,
      selected.rotation,
      null,
    );
  };

  // Open scrolled to the work: the layout's room if it's drawn on this plan,
  // otherwise the furniture already placed.
  const scrolledOnce = useRef(false);
  useEffect(() => {
    if (scrolledOnce.current || !draft || !scale || canvasBox.width <= 0) return;
    scrolledOnce.current = true;
    const outline = zoneOutline(draft.zone_id);
    const topFrac =
      outline && outline.floor === draft.floor
        ? outline.rect.y
        : draft.items.length
          ? Math.min(...draft.items.map((i) => i.y)) - 0.03
          : 0;
    const y = Math.max(0, topFrac) * planPxH;
    if (y > 0) requestAnimationFrame(() => canvasScroll.current?.scrollTo({ y, animated: false }));
  });

  const setSelectedLabel = (label: string) => {
    if (!selected) return;
    editItem(selected.id, (item) => ({ ...item, label: label || null }));
  };

  // Desktop shortcuts: arrows nudge, R / Shift+R rotate, Delete removes,
  // Escape deselects. Ignored while typing in a field.
  useEffect(() => {
    if (Platform.OS !== 'web' || !canEdit || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!selected) return;
      const step = e.shiftKey ? 1 : NUDGE_IN;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (moves[e.key]) {
        e.preventDefault();
        nudgeSelected(...moves[e.key]);
      } else if (e.key === 'r' || e.key === 'R') {
        rotateSelected(e.shiftKey ? -ROTATE_STEP : ROTATE_STEP);
      } else if (e.key === 'f' || e.key === 'F') {
        flipSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelected();
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const handleSave = async () => {
    if (!draft || !id) return;
    try {
      await saveLayout.mutateAsync({ id, ...toSaveInput(draft) });
      setDirty(false);
      setDroppedCount(0);
      showToast('Layout saved');
    } catch {
      // surfaced by the global mutation error toast
    }
  };

  const handleSaveAsCopy = async () => {
    if (!draft) return;
    setCopying(true);
    try {
      const copy = await saveLayout.mutateAsync({
        ...toSaveInput(draft),
        name: `${draft.name} (copy)`,
        items: draft.items.map((item) => ({ ...item, id: newItemId() })),
      });
      setDirty(false);
      showToast('Saved as a new layout');
      router.replace(`${basePath}/layouts/${copy.id}` as any);
    } catch {
      // surfaced by the global mutation error toast
    } finally {
      setCopying(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteLayout.mutateAsync(id);
      setConfirmDelete(false);
      setDirty(false);
      showToast('Layout deleted');
      router.replace(hubHref as any);
    } catch {
      // surfaced by the global mutation error toast
    }
  };

  const applySettings = (settings: LayoutSettings) => {
    setSettingsOpen(false);
    edit((d) => ({ ...d, ...settings }));
  };

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasBox((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height },
    );
  };

  const placedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    draft?.items.forEach((item) => counts.set(item.piece_id, (counts.get(item.piece_id) ?? 0) + 1));
    return counts;
  }, [draft?.items]);

  const tally = useMemo(
    () => (draft && pieces ? countPieces(draft.items, pieces) : []),
    [draft, pieces],
  );

  // ---- loading / failure ---------------------------------------------------

  const failure = layoutQuery.error ?? piecesQuery.error ?? scalesError;
  const missing = !layoutQuery.isLoading && !layout && id;
  if (failure || missing) {
    const notSetUp = failure instanceof LayoutsNotSetUpError;
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.centered}>
          <Ionicons name={notSetUp ? 'construct-outline' : 'alert-circle-outline'} size={32} color={Colors.textMuted} />
          <Text style={s.centeredTitle}>
            {notSetUp ? 'Layouts need a database update' : 'This layout couldn’t be opened'}
          </Text>
          <Text style={s.centeredText}>
            {notSetUp
              ? 'Apply the floor-layouts migrations in Supabase, then reopen this page.'
              : 'It may have been deleted. Go back to the list and pick another.'}
          </Text>
          <Button title="Back to layouts" variant="secondary" size="sm" onPress={() => router.replace(hubHref as any)} />
        </View>
      </SafeAreaView>
    );
  }

  if (!draft || scalesLoading) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!scale) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.centered}>
          <Ionicons name="resize-outline" size={32} color={Colors.textMuted} />
          <Text style={s.centeredTitle}>The {floorLabel(draft.floor).toLowerCase()} plan isn’t measured</Text>
          <Text style={s.centeredText}>
            {canEdit
              ? 'Add at least one measurement line to it, and this layout will be drawn to scale.'
              : 'An admin needs to measure this floor plan before the layout can be shown.'}
          </Text>
          {canEdit ? (
            <Button
              title="Measure the floor plan"
              size="sm"
              onPress={() => router.push(`/(admin)/locations/measure?floor=${draft.floor}` as any)}
            />
          ) : null}
          <Button title="Back to layouts" variant="ghost" size="sm" onPress={leave} />
        </View>
      </SafeAreaView>
    );
  }

  // ---- panel ---------------------------------------------------------------

  // The closest other piece, edge to edge — what a crew paces out for an
  // aisle. Measured between each piece's upright bounding box, which is exact
  // for pieces set square to the room and slightly short for turned ones.
  const nearest = selected && selectedPiece
    ? (() => {
        const box = (item: FloorLayoutItem, piece: FurniturePiece) => {
          const { halfW, halfH } = rotatedExtents(piece.width_in, piece.depth_in, item.rotation, piece.shape);
          return { x: item.x * planWIn, y: item.y * planHIn, halfW, halfH };
        };
        const me = box(selected, selectedPiece);
        let best: { gap: number; name: string } | null = null;
        draft.items.forEach((item) => {
          if (item.id === selected.id) return;
          const piece = pieceMap.get(item.piece_id);
          if (!piece) return;
          const other = box(item, piece);
          const dx = Math.max(0, Math.abs(me.x - other.x) - me.halfW - other.halfW);
          const dy = Math.max(0, Math.abs(me.y - other.y) - me.halfH - other.halfH);
          const gap = Math.hypot(dx, dy);
          if (!best || gap < best.gap) best = { gap, name: item.label || piece.name };
        });
        return best as { gap: number; name: string } | null;
      })()
    : null;

  const selectionPanel = selected && selectedPiece ? (
    <View style={s.panelSection}>
      <View style={s.selHeader}>
        {selectedPiece.photo_url ? (
          <Pressable
            onPress={() => setPhotoOpen(selectedPiece.photo_url)}
            accessibilityRole="button"
            accessibilityLabel={`Photo of ${selectedPiece.name}`}
          >
            <PieceSwatch piece={selectedPiece} size={56} />
          </Pressable>
        ) : (
          <PieceSwatch piece={selectedPiece} size={40} />
        )}
        <View style={s.selHeaderText}>
          <Text style={s.selName} numberOfLines={1}>
            {selected.label || selectedPiece.name}
          </Text>
          <Text style={s.selMeta} numberOfLines={1}>
            {selected.label ? `${selectedPiece.name} · ` : ''}
            {describePiece(selectedPiece)}
            {selected.rotation ? ` · turned ${selected.rotation}°` : ''}
            {selected.flip ? ' · mirrored' : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => setSelectedId(null)}
          hitSlop={8}
          style={s.iconClose}
          accessibilityRole="button"
          accessibilityLabel="Deselect"
        >
          <Ionicons name="close" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {nearest ? (
        <View style={s.gapCard}>
          <Text style={s.gapValue}>
            {Math.round(nearest.gap) <= 0 ? 'Touching' : formatInches(Math.round(nearest.gap))}
          </Text>
          <Text style={s.gapLabel} numberOfLines={1}>
            Gap to the nearest piece · {nearest.name}
          </Text>
        </View>
      ) : null}

      {canEdit ? (
        <>
          <View style={s.toolRow}>
            <ToolButton icon="arrow-undo-outline" label={`${ROTATE_STEP}°`} onPress={() => rotateSelected(-ROTATE_STEP)} a11y="Rotate left" />
            <ToolButton icon="arrow-redo-outline" label={`${ROTATE_STEP}°`} onPress={() => rotateSelected(ROTATE_STEP)} a11y="Rotate right" />
            <ToolButton icon="refresh-outline" label="90°" onPress={() => rotateSelected(90)} a11y="Quarter turn" />
            {selectedPiece.shape === 'l' ? (
              <ToolButton icon="swap-horizontal-outline" label="Flip" onPress={flipSelected} a11y="Mirror left to right" />
            ) : null}
            <ToolButton icon="copy-outline" label="Copy" onPress={copySelected} a11y="Place another" />
            <ToolButton icon="trash-outline" label="Remove" onPress={removeSelected} a11y="Remove from layout" danger />
          </View>

          <View style={s.nudgeRow}>
            <Text style={s.nudgeLabel}>Nudge {formatInches(NUDGE_IN)}</Text>
            <View style={s.nudgePad}>
              <ToolButton icon="arrow-back" onPress={() => nudgeSelected(-NUDGE_IN, 0)} a11y="Nudge left" compact />
              <ToolButton icon="arrow-up" onPress={() => nudgeSelected(0, -NUDGE_IN)} a11y="Nudge up" compact />
              <ToolButton icon="arrow-down" onPress={() => nudgeSelected(0, NUDGE_IN)} a11y="Nudge down" compact />
              <ToolButton icon="arrow-forward" onPress={() => nudgeSelected(NUDGE_IN, 0)} a11y="Nudge right" compact />
            </View>
          </View>

          <Text style={s.fieldLabel}>Label on the plan</Text>
          <TextInput
            value={selected.label ?? ''}
            onChangeText={setSelectedLabel}
            placeholder={`e.g. Table 4 — defaults to “${selectedPiece.name}”`}
            placeholderTextColor={Colors.textMuted}
            style={s.labelInput}
            maxLength={40}
          />
        </>
      ) : null}
    </View>
  ) : null;

  const overviewPanel = (
    <View style={s.panelSection}>
      {tally.length ? (
        <View style={s.tally}>
          {tally.map(({ piece, placed, over }) => (
            <View key={piece.id} style={s.tallyRow}>
              <PieceSwatch piece={piece} size={28} />
              <Text style={s.tallyName} numberOfLines={1}>
                {piece.name}
              </Text>
              {/* Stock is the admin's problem; crews just need the count. */}
              <Text style={[s.tallyCount, canEdit && over && s.tallyOver]}>
                {placed}
                {canEdit && piece.quantity != null ? ` of ${piece.quantity}` : ''}
              </Text>
              {canEdit && over ? <Ionicons name="warning" size={14} color={Colors.warning} /> : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.emptyText}>
          {canEdit ? 'The room is empty. Add furniture from your library to start the layout.' : 'Nothing has been placed in this layout yet.'}
        </Text>
      )}

      {canEdit && tally.some((t) => t.over) ? (
        <Text style={s.overNote}>
          This layout uses more of a piece than we own. Rent the difference or swap pieces.
        </Text>
      ) : null}

      {droppedCount > 0 ? (
        <Text style={s.overNote}>
          {droppedCount} {droppedCount === 1 ? 'piece was' : 'pieces were'} deleted from the library and{' '}
          {droppedCount === 1 ? 'isn’t' : 'aren’t'} shown.
        </Text>
      ) : null}

      {draft.notes ? (
        <View style={s.notes}>
          <Text style={s.fieldLabel}>Notes</Text>
          <Text style={s.notesText}>{draft.notes}</Text>
        </View>
      ) : null}

      {canEdit ? (
        <>
          <Button
            title="Add furniture"
            icon={<Ionicons name="add" size={18} color={Colors.bgPrimary} />}
            onPress={() => setPickerOpen(true)}
            fullWidth
          />
          <Text style={s.hint}>
            Drag pieces to move them. Tap one to rotate it, place another, or see the gap to its nearest neighbour.
            {Platform.OS === 'web' ? ' Arrow keys nudge, R rotates, F mirrors an L, Delete removes.' : ''}
          </Text>
          <View style={s.secondaryActions}>
            <Button title="Name & room" variant="secondary" size="sm" onPress={() => setSettingsOpen(true)} />
            <Button title="Save as copy" variant="secondary" size="sm" onPress={handleSaveAsCopy} loading={copying} />
            <Pressable
              onPress={() => setConfirmDelete(true)}
              accessibilityRole="button"
              style={({ pressed }) => [s.deleteLink, pressed && s.deleteLinkPressed]}
            >
              <Ionicons name="trash-outline" size={15} color={Colors.danger} />
              <Text style={s.deleteLinkText}>Delete layout</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={s.hint}>Tap a piece to see the gap to its nearest neighbour.</Text>
      )}
    </View>
  );

  const roomLine = `${layoutPlace(draft)} · ${pieceCountLabel(draft.items.length)}`;

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.topBar}>
        <Button title="← Back" onPress={requestLeave} variant="ghost" size="sm" />
        <View style={s.titleBlock}>
          <Text style={s.title} numberOfLines={1}>
            {draft.name}
          </Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {roomLine}
          </Text>
        </View>
        {canEdit ? (
          <Button
            title={dirty ? 'Save' : 'Saved'}
            onPress={handleSave}
            disabled={!dirty}
            loading={saveLayout.isPending && !copying}
            size="sm"
          />
        ) : null}
      </View>

      <View style={[s.body, isWide && s.bodyWide]}>
        <ScrollView
          ref={canvasScroll}
          style={s.canvasScroll}
          contentContainerStyle={s.canvasArea}
          onLayout={onCanvasLayout}
          scrollEnabled={!dragging}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
        >
          {canvasW > 0 ? (
            <LayoutCanvas
              floor={draft.floor}
              scale={scale}
              items={draft.items}
              pieces={pieceMap}
              maxWidth={canvasW}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={canEdit ? handleMove : undefined}
              onDragActiveChange={setDragging}
            />
          ) : null}
        </ScrollView>

        <ScrollView
          style={[s.panel, isWide ? s.panelWide : s.panelNarrow]}
          contentContainerStyle={s.panelContent}
          keyboardShouldPersistTaps="handled"
        >
          {selectionPanel ?? overviewPanel}
        </ScrollView>
      </View>

      {canEdit ? (
        <>
          <FurniturePickerSheet
            visible={pickerOpen}
            pieces={pieces ?? []}
            placedCounts={placedCounts}
            onPick={addPiece}
            onCreatePiece={() => {
              setPickerOpen(false);
              setPieceEditorOpen(true);
            }}
            onClose={() => setPickerOpen(false)}
          />
          <FurnitureEditorModal
            visible={pieceEditorOpen}
            piece={null}
            onClose={() => setPieceEditorOpen(false)}
            onSaved={(piece) => {
              // The new piece goes straight onto the part of the plan in view.
              const c = visibleCenter();
              place(piece, c.xIn, c.yIn, 0, null);
            }}
          />
          <LayoutSettingsModal
            visible={settingsOpen}
            title="Name & room"
            submitLabel="Apply"
            initial={draft}
            scales={scales}
            onSubmit={applySettings}
            onClose={() => setSettingsOpen(false)}
          />
          <ConfirmDialog
            visible={confirmDelete}
            title="Delete layout?"
            message={`“${draft.name}” will be removed for everyone. The furniture library isn’t affected.`}
            confirmLabel="Delete layout"
            destructive
            loading={deleteLayout.isPending}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        </>
      ) : null}

      <Lightbox
        images={photoOpen ? [photoOpen] : []}
        visible={!!photoOpen}
        onClose={() => setPhotoOpen(null)}
      />

      <ConfirmDialog
        visible={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes to this layout. Leaving now throws them away."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          leave();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </SafeAreaView>
  );
}

function toDraft(layout: FloorLayout, items: FloorLayoutItem[]): Draft {
  return {
    name: layout.name,
    floor: layout.floor,
    zone_id: layout.zone_id,
    notes: layout.notes,
    items,
  };
}

function toSaveInput(draft: Draft) {
  return {
    name: draft.name,
    floor: draft.floor,
    zone_id: draft.zone_id,
    notes: draft.notes,
    items: draft.items,
  };
}

interface ToolButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  a11y: string;
  onPress: () => void;
  danger?: boolean;
  compact?: boolean;
}

function ToolButton({ icon, label, a11y, onPress, danger, compact }: ToolButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [s.tool, compact ? s.toolCompact : s.toolFill, pressed && s.toolPressed]}
    >
      <Ionicons name={icon} size={18} color={danger ? Colors.danger : Colors.text} />
      {label ? <Text style={[s.toolLabel, danger && s.toolLabelDanger]}>{label}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  centeredTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  centeredText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  body: {
    flex: 1,
  },
  bodyWide: {
    flexDirection: 'row',
  },
  canvasScroll: {
    flex: 1,
  },
  canvasArea: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  gapCard: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
  },
  gapValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  gapLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderColor: Colors.border,
  },
  panelNarrow: {
    flexGrow: 0,
    maxHeight: '46%',
    borderTopWidth: 1,
  },
  panelWide: {
    width: 340,
    flexGrow: 0,
    borderLeftWidth: 1,
  },
  panelContent: {
    padding: Spacing.md,
  },
  panelSection: {
    gap: Spacing.md,
  },
  selHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  selHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  selName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  selMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  iconClose: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  wallGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  wallCell: {
    width: '50%',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderColor: Colors.border,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wallValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  wallLabel: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  toolRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tool: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toolFill: {
    flex: 1,
  },
  toolCompact: {
    width: 44,
    minHeight: 40,
  },
  toolPressed: {
    borderColor: Colors.accent,
  },
  toolLabel: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  toolLabelDanger: {
    color: Colors.danger,
  },
  nudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nudgeLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  nudgePad: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -Spacing.sm,
  },
  labelInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  tally: {
    gap: Spacing.xs,
  },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 32,
  },
  tallyName: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  tallyCount: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  tallyOver: {
    color: Colors.warning,
  },
  overNote: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    lineHeight: 17,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  notes: {
    gap: Spacing.sm,
  },
  notesText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  deleteLinkPressed: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  deleteLinkText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.danger,
  },
});
