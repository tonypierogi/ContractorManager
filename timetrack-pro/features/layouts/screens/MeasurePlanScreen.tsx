import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import DimensionField from '@/features/layouts/components/DimensionField';
import PlanLinesCanvas, { type LineDraft } from '@/features/layouts/components/PlanLinesCanvas';
import { LayoutsNotSetUpError } from '@/features/layouts/api';
import {
  useDeleteMeasurement,
  usePlanMeasurements,
  useSaveMeasurement,
} from '@/features/layouts/hooks';
import {
  PLAN_FLOORS,
  fitPlanScale,
  floorLabel,
  formatInches,
  formatSize,
  lineLengthAt,
  newItemId,
} from '@/features/layouts/geometry';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { FloorPlanMeasurement, PlanFloor } from '@/types/database';

const HUB = '/(admin)/locations?tab=layouts&step=plan';

/** How far a line's fitted length may stray from its tape measure before it's flagged. */
const OFF_WARN = 0.05;

/**
 * Step 1 of floor layouts: drag lines along things on the floor plan you've
 * measured with a tape, and type their real lengths. Each floor's scale is
 * fitted from all of its lines together, and every layout on that floor is
 * drawn at that scale.
 *
 * Line edits stay in a local draft until Save; deleting a saved line happens
 * straight away, after a confirm.
 */
export default function MeasurePlanScreen() {
  const params = useLocalSearchParams<{ floor?: string }>();
  const { showToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 900;

  const linesQuery = usePlanMeasurements();
  const saveLine = useSaveMeasurement();
  const deleteLine = useDeleteMeasurement();

  const [floor, setFloor] = useState<PlanFloor>(
    params.floor === 'downstairs' ? 'downstairs' : 'upstairs',
  );
  const [drafts, setDrafts] = useState<LineDraft[] | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [canvasColumn, setCanvasColumn] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canvasScroll = useRef<ScrollView>(null);

  const dirty = dirtyIds.size > 0;

  // Seed from the server, and re-seed after a save while nothing is pending.
  const saved = linesQuery.data;
  useEffect(() => {
    if (!saved || dirty) return;
    setDrafts(saved.map(toDraft));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty || typeof window === 'undefined') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const floorLines = useMemo(() => (drafts ?? []).filter((l) => l.floor === floor), [drafts, floor]);
  const selected = drafts?.find((l) => l.id === selectedId) ?? null;

  // The scale as it stands with every line typed so far, saved or not, so
  // the fit updates while you work.
  const scale = useMemo(
    () =>
      fitPlanScale(
        floor,
        floorLines.flatMap((l) => (l.length_in ? [{ ...l, length_in: l.length_in }] : [])),
      ),
    [floor, floorLines],
  );

  const update = (id: string, change: (l: LineDraft) => LineDraft) => {
    setDrafts((list) => list?.map((l) => (l.id === id ? change(l) : l)) ?? list);
    setDirtyIds((ids) => new Set(ids).add(id));
  };

  const drawLine = (ends: Pick<LineDraft, 'x1' | 'y1' | 'x2' | 'y2'>) => {
    const line: LineDraft = { id: `new-${newItemId()}`, floor, label: '', length_in: null, ...ends };
    setDrafts((list) => [...(list ?? []), line]);
    setDirtyIds((ids) => new Set(ids).add(line.id));
    setSelectedId(line.id);
    setShowErrors(false);
  };

  const handleSave = async () => {
    if (!drafts) return;
    const pending = drafts.filter((l) => dirtyIds.has(l.id));
    const missing = pending.find((l) => !l.length_in);
    if (missing) {
      setShowErrors(true);
      setFloor(missing.floor);
      setSelectedId(missing.id);
      showToast('Give every line its real length before saving', 'error');
      return;
    }
    setSaving(true);
    try {
      for (const l of pending) {
        const result = await saveLine.mutateAsync({
          id: l.id.startsWith('new-') ? undefined : l.id,
          floor: l.floor,
          label: l.label,
          x1: l.x1,
          y1: l.y1,
          x2: l.x2,
          y2: l.y2,
          length_in: l.length_in!,
        });
        // Clear each one as it lands, so a failure part-way keeps only the
        // unsaved lines marked.
        setDrafts((list) => list?.map((d) => (d.id === l.id ? toDraft(result) : d)) ?? list);
        setDirtyIds((ids) => {
          const next = new Set(ids);
          next.delete(l.id);
          return next;
        });
        setSelectedId((sel) => (sel === l.id ? result.id : sel));
      }
      setShowErrors(false);
      showToast(pending.length === 1 ? 'Line saved' : `${pending.length} lines saved`);
    } catch {
      // surfaced by the global mutation error toast
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const id = selected.id;
    try {
      if (!id.startsWith('new-')) await deleteLine.mutateAsync(id);
      setDrafts((list) => list?.filter((l) => l.id !== id) ?? list);
      setDirtyIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
      setSelectedId(null);
      setConfirmDelete(false);
      showToast('Line deleted');
    } catch {
      // surfaced by the global mutation error toast
    }
  };

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(HUB as any);
  };

  const onCanvasColumnLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setCanvasColumn((prev) => (Math.abs(prev - w) < 1 ? prev : w));
  };

  // ---- loading / failure ---------------------------------------------------

  if (linesQuery.error) {
    const notSetUp = linesQuery.error instanceof LayoutsNotSetUpError;
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.centered}>
          <Ionicons name={notSetUp ? 'construct-outline' : 'alert-circle-outline'} size={32} color={Colors.textMuted} />
          <Text style={s.centeredTitle}>
            {notSetUp ? 'Floor layouts need a database update' : 'The floor plans couldn’t be loaded'}
          </Text>
          <Text style={s.centeredText}>
            {notSetUp
              ? 'Apply the floor-layouts migrations in Supabase, then reopen this page.'
              : 'Check your connection and try again.'}
          </Text>
          <Button title="Back to layouts" variant="secondary" size="sm" onPress={() => router.replace(HUB as any)} />
        </View>
      </SafeAreaView>
    );
  }

  if (!drafts) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const planWidth = Math.max(0, Math.min(canvasColumn - Spacing.md * 2, 620));
  const floorName = floorLabel(floor).toLowerCase();

  /** How far this line's length at the fitted scale is from what was typed. */
  const offBy = (l: LineDraft) =>
    scale && l.length_in && scale.lineCount > 1 ? lineLengthAt(scale, l) / l.length_in - 1 : null;

  const selectedOff = selected ? offBy(selected) : null;

  const selectionPanel = selected ? (
    <View style={s.panelSection}>
      <View style={s.panelHeader}>
        <Text style={s.panelTitle}>{selected.label.trim() || 'Measurement line'}</Text>
        <Pressable
          onPress={() => setSelectedId(null)}
          hitSlop={8}
          style={s.iconClose}
          accessibilityRole="button"
          accessibilityLabel="Done with this line"
        >
          <Ionicons name="close" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <View style={s.lengthRow}>
        <DimensionField
          label="Real length"
          value={selected.length_in}
          onChange={(v) => update(selected.id, (l) => ({ ...l, length_in: v }))}
          error={showErrors && !selected.length_in ? 'Enter what you measured with the tape' : undefined}
        />
      </View>
      <Input
        label="What you measured (optional)"
        placeholder="e.g. Big Room, back wall"
        value={selected.label}
        onChangeText={(label) => update(selected.id, (l) => ({ ...l, label }))}
      />

      {selectedOff != null ? (
        <View style={[s.check, Math.abs(selectedOff) > OFF_WARN && s.checkOff]}>
          <Ionicons
            name={Math.abs(selectedOff) > OFF_WARN ? 'warning-outline' : 'checkmark-circle-outline'}
            size={16}
            color={Math.abs(selectedOff) > OFF_WARN ? Colors.warning : Colors.success}
          />
          <Text style={s.checkText}>
            With every line on this floor combined, this one reads{' '}
            <Text style={s.checkStrong}>{formatInches(lineLengthAt(scale!, selected))}</Text> (
            {formatPercent(selectedOff)}).
            {Math.abs(selectedOff) > OFF_WARN
              ? ' Check its ends sit exactly where you measured, or re-check the tape.'
              : ''}
          </Text>
        </View>
      ) : null}

      <Text style={s.hint}>
        Drag the dots to put the ends exactly where the tape started and stopped — wall to wall,
        or across a doorway. Lines snap level or plumb when they’re close.
      </Text>

      <Pressable
        onPress={() => setConfirmDelete(true)}
        accessibilityRole="button"
        style={({ pressed }) => [s.deleteLink, pressed && s.deleteLinkPressed]}
      >
        <Ionicons name="trash-outline" size={15} color={Colors.danger} />
        <Text style={s.deleteLinkText}>Delete line</Text>
      </Pressable>
    </View>
  ) : null;

  const overviewPanel = (
    <View style={s.panelSection}>
      <Text style={s.panelIntro}>
        Drag across the plan along something you’ve measured — a wall, a doorway, the gap between
        two columns — then type its real length. Two or three lines, running both ways, give the
        best scale.
      </Text>

      <View style={s.scaleCard}>
        <Text style={s.scaleLabel}>{floorLabel(floor)} at this scale</Text>
        {scale ? (
          <>
            <Text style={s.scaleValue}>{formatSize(scale.widthIn, scale.depthIn)}</Text>
            <Text style={s.scaleMeta}>
              Fitted from {scale.lineCount} {scale.lineCount === 1 ? 'line' : 'lines'}
              {scale.fit === 'both' ? ', width and height measured separately.' : '.'}
            </Text>
            {scale.fit === 'uniform' ? (
              <Text style={s.scaleTip}>
                Every line runs the same way, so the plan’s proportions are assumed. Add one running
                the other way to measure its height too.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={s.scaleMeta}>
            Not measured yet — layouts can’t be drawn on the {floorName} plan until it has a line.
          </Text>
        )}
      </View>

      {floorLines.length ? (
        <View style={s.lineList}>
          {floorLines.map((l, index) => {
            const off = offBy(l);
            const flagged = off != null && Math.abs(off) > OFF_WARN;
            return (
              <Pressable
                key={l.id}
                onPress={() => setSelectedId(l.id)}
                style={({ pressed }) => [s.lineRow, index > 0 && s.lineRowDivider, pressed && s.lineRowPressed]}
                accessibilityRole="button"
              >
                <View style={[s.lineSwatch, !l.length_in && s.lineSwatchMissing]} />
                <View style={s.lineText}>
                  <Text style={s.lineName} numberOfLines={1}>
                    {l.length_in ? formatInches(l.length_in) : 'No length yet'}
                    {l.label.trim() ? <Text style={s.lineLabel}>  {l.label.trim()}</Text> : null}
                  </Text>
                  <Text style={[s.lineMeta, flagged && s.lineMetaOff]} numberOfLines={1}>
                    {dirtyIds.has(l.id) ? 'Unsaved' : 'Saved'}
                    {off != null ? ` · ${formatPercent(off)} against the fit` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.topBar}>
        <Button title="← Back" onPress={() => (dirty ? setConfirmLeave(true) : leave())} variant="ghost" size="sm" />
        <View style={s.titleBlock}>
          <Text style={s.title} numberOfLines={1}>
            Measure the floor plans
          </Text>
          <Text style={s.subtitle} numberOfLines={1}>
            Step 1 of 3 · {dirty ? `${dirtyIds.size} unsaved` : 'All saved'}
          </Text>
        </View>
        <Button title={dirty ? 'Save' : 'Saved'} onPress={handleSave} disabled={!dirty} loading={saving} size="sm" />
      </View>

      <View style={s.floorTabs}>
        {PLAN_FLOORS.map((f) => {
          const active = floor === f.key;
          const count = drafts.filter((l) => l.floor === f.key).length;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                setFloor(f.key);
                setSelectedId(null);
                canvasScroll.current?.scrollTo({ y: 0, animated: false });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[s.floorTab, active && s.floorTabActive]}
            >
              <Text style={[s.floorTabText, active && s.floorTabTextActive]}>
                {f.label}
                {count ? ` · ${count} ${count === 1 ? 'line' : 'lines'}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[s.body, isWide && s.bodyWide]}>
        <ScrollView
          ref={canvasScroll}
          style={s.canvasScroll}
          contentContainerStyle={s.canvasContent}
          scrollEnabled={!dragging}
          onLayout={onCanvasColumnLayout}
        >
          {planWidth > 0 ? (
            <PlanLinesCanvas
              floor={floor}
              lines={floorLines}
              width={planWidth}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDraw={drawLine}
              onChangeEnds={(id, ends) => update(id, (l) => ({ ...l, ...ends }))}
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

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this line?"
        message={`The ${floorName} plan’s scale will be refitted from the lines that are left. Layouts on this floor resize to match.`}
        confirmLabel="Delete line"
        destructive
        loading={deleteLine.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        visible={confirmLeave}
        title="Discard changes?"
        message={`${dirtyIds.size} ${dirtyIds.size === 1 ? 'line has' : 'lines have'} unsaved changes. Leaving now throws them away.`}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmLeave(false);
          setDirtyIds(new Set());
          leave();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </SafeAreaView>
  );
}

function toDraft(line: FloorPlanMeasurement): LineDraft {
  return {
    id: line.id,
    floor: line.floor,
    label: line.label ?? '',
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
    length_in: line.length_in,
  };
}

/** +2.4% / −1.1% / 0% */
function formatPercent(fraction: number): string {
  const pct = Math.round(fraction * 1000) / 10;
  if (pct === 0) return 'spot on';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
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
  },
  floorTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  floorTab: {
    paddingHorizontal: Spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
  },
  floorTabActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  floorTabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  floorTabTextActive: {
    color: Colors.accent,
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
  canvasContent: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderColor: Colors.border,
  },
  panelNarrow: {
    flexGrow: 0,
    maxHeight: '45%',
    borderTopWidth: 1,
  },
  panelWide: {
    width: 360,
    flexGrow: 0,
    borderLeftWidth: 1,
  },
  panelContent: {
    padding: Spacing.md,
  },
  panelSection: {
    gap: Spacing.md,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  panelTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  panelIntro: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  iconClose: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  lengthRow: {
    flexDirection: 'row',
    marginBottom: -Spacing.md,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  check: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
  },
  checkOff: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  checkText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  checkStrong: {
    color: Colors.text,
    fontWeight: '700',
  },
  scaleCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
  },
  scaleLabel: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scaleValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  scaleMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  scaleTip: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    lineHeight: 17,
    marginTop: Spacing.xs,
  },
  lineList: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 52,
    backgroundColor: Colors.bgSecondary,
  },
  lineRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  lineRowPressed: {
    backgroundColor: Colors.bgElevated,
  },
  lineSwatch: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#f472b6',
  },
  lineSwatchMissing: {
    backgroundColor: Colors.warning,
  },
  lineText: {
    flex: 1,
    minWidth: 0,
  },
  lineName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  lineLabel: {
    fontSize: FontSize.sm,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  lineMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  lineMetaOff: {
    color: Colors.warning,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
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
