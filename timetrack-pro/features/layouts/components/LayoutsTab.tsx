import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import LayoutCanvas from '@/features/layouts/components/LayoutCanvas';
import LayoutSettingsModal, {
  type LayoutSettings,
} from '@/features/layouts/components/LayoutSettingsModal';
import FurnitureEditorModal from '@/features/layouts/components/FurnitureEditorModal';
import PieceSwatch from '@/features/layouts/components/PieceSwatch';
import { LayoutsNotSetUpError } from '@/features/layouts/api';
import {
  useFloorLayouts,
  useFurniturePieces,
  usePlanScales,
  useSaveFloorLayout,
  useSaveFurniturePiece,
} from '@/features/layouts/hooks';
import {
  FULL_PLAN,
  PLAN_FLOORS,
  countPieces,
  describePiece,
  formatSize,
  layoutPlace,
  pieceCountLabel,
  planAspect,
  planImage,
  zoneOutline,
  type PlanRect,
  type PlanScale,
} from '@/features/layouts/geometry';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type {
  FloorLayout,
  FloorPlanMeasurement,
  FurniturePiece,
  PlanFloor,
} from '@/types/database';

interface Props {
  /** Admins measure the plans, build the furniture library and edit layouts. */
  canEdit?: boolean;
}

type Step = 'plan' | 'furniture' | 'layouts';

const STEPS: { key: Step; label: string }[] = [
  { key: 'plan', label: 'Floor plan' },
  { key: 'furniture', label: 'Furniture' },
  { key: 'layouts', label: 'Layouts' },
];

const MEASURE_ROUTE = '/(admin)/locations/measure';

/**
 * Floor layouts in three steps, in the order they're built: measure the floor
 * plan with lines, measure the furniture, then arrange furniture over the plan.
 * Crews only see the finished layouts.
 */
export default function LayoutsTab({ canEdit = false }: Props) {
  const params = useLocalSearchParams<{ step?: string }>();
  const inEmployeeView = useSegments()[0] === '(employee)';
  const planScales = usePlanScales();
  const piecesQuery = useFurniturePieces();
  const layoutsQuery = useFloorLayouts();

  const initialStep = STEPS.some((st) => st.key === params.step) ? (params.step as Step) : 'layouts';
  const [step, setStepState] = useState<Step>(canEdit ? initialStep : 'layouts');
  const setStep = (next: Step) => {
    setStepState(next);
    router.setParams({ step: next });
  };

  const { scales } = planScales;
  const lines = planScales.lines ?? [];
  const pieces = piecesQuery.data ?? [];
  const layouts = layoutsQuery.data ?? [];

  const errors = [planScales.error, piecesQuery.error, layoutsQuery.error];
  const notSetUp = errors.some((e) => e instanceof LayoutsNotSetUpError);

  if (planScales.isLoading || piecesQuery.isLoading || layoutsQuery.isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (notSetUp) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.notice}>
          <Ionicons name="construct-outline" size={22} color={Colors.warning} />
          <View style={s.noticeText}>
            <Text style={s.noticeTitle}>
              {canEdit ? 'Floor layouts need a database update' : 'No layouts yet'}
            </Text>
            <Text style={s.noticeBody}>
              {canEdit
                ? 'Run the two floor-layout migrations (supabase/migrations/20260919120000_floor_layouts.sql, then 20260919150000_floor_plan_lines.sql) in the Supabase SQL editor, then come back to this tab.'
                : 'Once an admin saves a room layout it will show up here.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  const counts: Record<Step, string> = {
    plan: lines.length ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}` : 'Start here',
    furniture: pieceCountLabel(pieces.length),
    layouts: `${layouts.length} saved`,
  };

  return (
    <ScrollView contentContainerStyle={s.content}>
      {canEdit ? (
        <View style={s.steps}>
          {STEPS.map((st, index) => {
            const active = step === st.key;
            return (
              <Pressable
                key={st.key}
                onPress={() => setStep(st.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[s.step, active && s.stepActive]}
              >
                <View style={[s.stepNum, active && s.stepNumActive]}>
                  <Text style={[s.stepNumText, active && s.stepNumTextActive]}>{index + 1}</Text>
                </View>
                <View style={s.stepText}>
                  <Text style={[s.stepLabel, active && s.stepLabelActive]} numberOfLines={1}>
                    {st.label}
                  </Text>
                  <Text style={s.stepMeta} numberOfLines={1}>
                    {counts[st.key]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {step === 'plan' && canEdit ? (
        <PlanStep lines={lines} scales={scales} layouts={layouts} />
      ) : step === 'furniture' && canEdit ? (
        <FurnitureStep pieces={pieces} layouts={layouts} />
      ) : (
        <LayoutsStep
          canEdit={canEdit}
          basePath={inEmployeeView ? '/(employee)/venue' : '/(admin)/locations'}
          scales={scales}
          pieces={pieces}
          layouts={layouts}
          onMeasure={() => setStep('plan')}
        />
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — the measured floor plans
// ---------------------------------------------------------------------------

interface PlanStepProps {
  lines: FloorPlanMeasurement[];
  scales: Record<PlanFloor, PlanScale | null>;
  layouts: FloorLayout[];
}

function PlanStep({ lines, scales, layouts }: PlanStepProps) {
  const { width } = useWindowDimensions();
  const twoUp = width >= 700;

  const open = (floor: PlanFloor) => router.push(`${MEASURE_ROUTE}?floor=${floor}` as any);

  return (
    <View>
      <StepIntro
        title="Measure the floor plan"
        body="Drag a line along something you’ve measured with a tape — a wall, a doorway — and type its real length. Two or three lines per floor, running both ways, set the scale."
        action={{ label: 'Measure', icon: 'resize-outline', onPress: () => open('upstairs') }}
      />
      <View style={[s.floorGrid, twoUp && s.floorGridTwoUp]}>
        {PLAN_FLOORS.map((floor) => {
          const onFloor = lines.filter((l) => l.floor === floor.key);
          const scale = scales[floor.key];
          const used = layouts.filter((l) => l.floor === floor.key).length;
          return (
            <View key={floor.key} style={[s.floorCard, twoUp && s.floorCardTwoUp]}>
              <Pressable
                onPress={() => open(floor.key)}
                accessibilityRole="button"
                accessibilityLabel={`Measure the ${floor.label.toLowerCase()} plan`}
              >
                <PlanThumb floor={floor.key} lines={onFloor} height={200} />
              </Pressable>
              <View style={s.floorInfo}>
                <Text style={s.floorTitle}>{floor.label}</Text>
                {scale ? (
                  <>
                    <Text style={s.floorSize}>{formatSize(scale.widthIn, scale.depthIn)}</Text>
                    <Text style={s.areaMeta}>
                      From {onFloor.length} {onFloor.length === 1 ? 'line' : 'lines'}
                      {used ? ` · ${used} ${used === 1 ? 'layout' : 'layouts'}` : ''}
                    </Text>
                    {scale.fit === 'uniform' ? (
                      <Text style={s.floorTip}>Add a line running the other way for a better fit.</Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={s.muted}>Not measured yet.</Text>
                )}
                <View style={s.floorAction}>
                  <Button
                    title={onFloor.length ? 'Edit lines' : 'Measure this floor'}
                    variant="secondary"
                    size="sm"
                    onPress={() => open(floor.key)}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** A floor plan with its measurement lines drawn on — static, for the overview. */
function PlanThumb({ floor, lines, height }: { floor: PlanFloor; lines: FloorPlanMeasurement[]; height: number }) {
  const width = height * planAspect(floor);
  return (
    <View style={[s.planThumb, { width, height }]}>
      <Image source={planImage(floor)} resizeMode="stretch" style={{ width, height, opacity: 0.8 }} />
      {lines.map((l) => {
        const x1 = l.x1 * width;
        const y1 = l.y1 * height;
        const x2 = l.x2 * width;
        const y2 = l.y2 * height;
        const len = Math.hypot(x2 - x1, y2 - y1);
        return (
          <View
            key={l.id}
            style={[
              s.planThumbLine,
              {
                left: (x1 + x2) / 2 - len / 2,
                top: (y1 + y2) / 2 - 1,
                width: len,
                transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — the furniture library
// ---------------------------------------------------------------------------

function FurnitureStep({ pieces, layouts }: { pieces: FurniturePiece[]; layouts: FloorLayout[] }) {
  const { showToast } = useToast();
  const savePiece = useSaveFurniturePiece();
  const [editor, setEditor] = useState<{ open: boolean; piece: FurniturePiece | null }>({
    open: false,
    piece: null,
  });
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // How many layouts place each piece — for the rows and the delete warning.
  const layoutsUsing = useMemo(() => {
    const m = new Map<string, number>();
    layouts.forEach((l) => {
      new Set(l.items.map((i) => i.piece_id)).forEach((pid) => m.set(pid, (m.get(pid) ?? 0) + 1));
    });
    return m;
  }, [layouts]);

  const duplicate = async (piece: FurniturePiece) => {
    setDuplicatingId(piece.id);
    try {
      const copy = await savePiece.mutateAsync({
        name: `${piece.name} (copy)`,
        shape: piece.shape,
        width_in: piece.width_in,
        depth_in: piece.depth_in,
        arm_in: piece.arm_in,
        quantity: piece.quantity,
        color: piece.color,
        photo_url: piece.photo_url,
        notes: piece.notes,
      });
      showToast('Copy added — rename or resize it');
      setEditor({ open: true, piece: copy });
    } catch {
      // surfaced by the global mutation error toast
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <View>
      <StepIntro
        title="Measure your furniture"
        body="Add each kind of table, chair or stage piece once, with how many you own. Duplicate a piece to make a similar one quickly."
        action={{ label: 'Add furniture', icon: 'add', onPress: () => setEditor({ open: true, piece: null }) }}
      />

      {pieces.length ? (
        <View style={s.library}>
          {pieces.map((piece, index) => {
            const used = layoutsUsing.get(piece.id) ?? 0;
            return (
              <View key={piece.id} style={[s.pieceRow, index > 0 && s.pieceRowDivider]}>
                <Pressable
                  onPress={() => setEditor({ open: true, piece })}
                  style={({ pressed }) => [s.pieceMain, pressed && s.pieceMainPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${piece.name}`}
                >
                  <PieceSwatch piece={piece} size={40} />
                  <View style={s.pieceText}>
                    <Text style={s.pieceName} numberOfLines={1}>
                      {piece.name}
                    </Text>
                    <Text style={s.pieceMeta} numberOfLines={1}>
                      {describePiece(piece)}
                      {used ? ` · in ${used} ${used === 1 ? 'layout' : 'layouts'}` : ''}
                    </Text>
                  </View>
                  {piece.quantity != null ? (
                    <View style={s.qty}>
                      <Text style={s.qtyValue}>{piece.quantity}</Text>
                      <Text style={s.qtyLabel}>owned</Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={() => duplicate(piece)}
                  disabled={duplicatingId != null}
                  accessibilityRole="button"
                  accessibilityLabel={`Duplicate ${piece.name}`}
                  style={({ pressed }) => [s.rowAction, pressed && s.rowActionPressed]}
                >
                  {duplicatingId === piece.id ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyBlock icon="cube-outline" title="No furniture yet" body="Add your first piece — a 6′ banquet table, a 60″ round — and it can be placed in any layout." />
      )}

      <FurnitureEditorModal
        visible={editor.open}
        piece={editor.piece}
        usedInLayouts={editor.piece ? layoutsUsing.get(editor.piece.id) ?? 0 : 0}
        onClose={() => setEditor({ open: false, piece: null })}
        onDuplicated={(copy) => setEditor({ open: true, piece: copy })}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — the layouts
// ---------------------------------------------------------------------------

interface LayoutsStepProps {
  canEdit: boolean;
  basePath: string;
  scales: Record<PlanFloor, PlanScale | null>;
  pieces: FurniturePiece[];
  layouts: FloorLayout[];
  onMeasure: () => void;
}

/** Groups layouts by where they are: a room, or a floor with no room set. */
const placeKey = (l: FloorLayout) => `${l.floor}:${l.zone_id ?? ''}`;

function LayoutsStep({ canEdit, basePath, scales, pieces, layouts, onMeasure }: LayoutsStepProps) {
  const { width } = useWindowDimensions();
  const { showToast } = useToast();
  const saveLayout = useSaveFloorLayout();
  const [placeFilter, setPlaceFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const pieceMap = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces]);

  // Places that have at least one layout, in the order they first appear.
  const places = useMemo(() => {
    const seen = new Map<string, string>();
    layouts.forEach((l) => {
      if (!seen.has(placeKey(l))) seen.set(placeKey(l), layoutPlace(l));
    });
    return [...seen.entries()];
  }, [layouts]);

  const visible = placeFilter ? layouts.filter((l) => placeKey(l) === placeFilter) : layouts;
  const anyMeasured = PLAN_FLOORS.some((f) => scales[f.key]);
  const openLayout = (id: string) => router.push(`${basePath}/layouts/${id}` as any);

  const createLayout = async (settings: LayoutSettings) => {
    try {
      const created = await saveLayout.mutateAsync({ ...settings, items: [] });
      setCreating(false);
      showToast('Layout created');
      openLayout(created.id);
    } catch {
      // surfaced by the global mutation error toast
    }
  };

  // Two thumbnails a row on a phone, more as the screen widens.
  const contentWidth = width - Spacing.lg * 2;
  const columns = contentWidth >= 900 ? 4 : contentWidth >= 560 ? 3 : 2;
  const cardWidth = (contentWidth - Spacing.md * (columns - 1)) / columns;

  return (
    <View>
      {canEdit ? (
        <StepIntro
          title="Arrange the furniture"
          body="Place your furniture on the floor plan, to scale. Save as many setups per room as you need."
          action={{ label: 'New layout', icon: 'add', onPress: () => setCreating(true) }}
        />
      ) : null}

      {places.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {[[null, 'All rooms'] as const, ...places].map(([key, label]) => {
            const active = placeFilter === key;
            return (
              <Pressable
                key={key ?? 'all'}
                onPress={() => setPlaceFilter(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {visible.length ? (
        <View style={s.grid}>
          {visible.map((layout) => (
            <LayoutCard
              key={layout.id}
              layout={layout}
              scale={scales[layout.floor]}
              pieces={pieces}
              pieceMap={pieceMap}
              width={cardWidth}
              showStock={canEdit}
              onPress={() => openLayout(layout.id)}
            />
          ))}
        </View>
      ) : (
        <EmptyBlock
          icon="grid-outline"
          title="No layouts yet"
          body={
            canEdit
              ? anyMeasured
                ? 'Create one and arrange your furniture on the floor plan.'
                : 'Measure the floor plan first (step 1), then add your furniture (step 2).'
              : 'Once an admin saves a room layout it will show up here.'
          }
        />
      )}

      {canEdit ? (
        <LayoutSettingsModal
          visible={creating}
          title="New layout"
          submitLabel="Create and arrange"
          initial={null}
          scales={scales}
          loading={saveLayout.isPending}
          onSubmit={createLayout}
          onClose={() => setCreating(false)}
          onMeasure={() => {
            setCreating(false);
            onMeasure();
          }}
        />
      ) : null}
    </View>
  );
}

interface LayoutCardProps {
  layout: FloorLayout;
  scale: PlanScale | null;
  pieces: FurniturePiece[];
  pieceMap: Map<string, FurniturePiece>;
  width: number;
  showStock: boolean;
  onPress: () => void;
}

const THUMB_HEIGHT = 130;
const CARD_PAD = Spacing.sm + 2;

function LayoutCard({ layout, scale, pieces, pieceMap, width, showStock, onPress }: LayoutCardProps) {
  const placed = layout.items.filter((i) => pieceMap.has(i.piece_id));
  const over = showStock && countPieces(placed, pieces).some((c) => c.over);
  const thumbWidth = width - CARD_PAD * 2;
  const crop = useMemo(
    () => (scale ? thumbnailCrop(layout, placed, pieceMap, scale) : FULL_PLAN),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, scale, pieceMap],
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, { width }, pressed && s.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${layout.name}`}
    >
      <View style={[s.thumb, { height: THUMB_HEIGHT }]}>
        {scale ? (
          <LayoutCanvas
            floor={layout.floor}
            scale={scale}
            crop={crop}
            items={placed}
            pieces={pieceMap}
            maxWidth={thumbWidth - 8}
            maxHeight={THUMB_HEIGHT - 8}
            compact
          />
        ) : (
          <Text style={s.thumbMissing}>Plan not measured</Text>
        )}
      </View>
      <Text style={s.cardName} numberOfLines={2}>
        {layout.name}
      </Text>
      <Text style={s.cardMeta} numberOfLines={1}>
        {layoutPlace(layout)}
      </Text>
      <View style={s.cardFoot}>
        <Text style={s.cardCount}>{pieceCountLabel(placed.length)}</Text>
        {over ? (
          <View style={s.overPill}>
            <Ionicons name="warning" size={11} color={Colors.warning} />
            <Text style={s.overPillText}>Over stock</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The part of the plan a thumbnail shows: the furniture with a little room
 * around it, else the layout's room, else the whole floor.
 */
function thumbnailCrop(
  layout: FloorLayout,
  placed: FloorLayout['items'],
  pieceMap: Map<string, FurniturePiece>,
  scale: PlanScale,
): PlanRect {
  if (placed.length) {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    placed.forEach((item) => {
      const piece = pieceMap.get(item.piece_id);
      const halfX = piece ? Math.max(piece.width_in, piece.depth_in) / 2 / scale.widthIn : 0;
      const halfY = piece ? Math.max(piece.width_in, piece.depth_in) / 2 / scale.depthIn : 0;
      x0 = Math.min(x0, item.x - halfX);
      y0 = Math.min(y0, item.y - halfY);
      x1 = Math.max(x1, item.x + halfX);
      y1 = Math.max(y1, item.y + halfY);
    });
    // 4′ of plan around the furniture for context.
    const mx = 48 / scale.widthIn;
    const my = 48 / scale.depthIn;
    const x = Math.max(0, x0 - mx);
    const y = Math.max(0, y0 - my);
    return { x, y, w: Math.min(1, x1 + mx) - x, h: Math.min(1, y1 + my) - y };
  }
  const outline = zoneOutline(layout.zone_id);
  return outline && outline.floor === layout.floor ? outline.rect : FULL_PLAN;
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

interface StepIntroProps {
  title: string;
  body: string;
  action?: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
}

function StepIntro({ title, body, action }: StepIntroProps) {
  return (
    <View style={s.intro}>
      <View style={s.introText}>
        <Text style={s.introTitle}>{title}</Text>
        <Text style={s.introBody}>{body}</Text>
      </View>
      {action ? (
        <Button
          title={action.label}
          size="sm"
          icon={<Ionicons name={action.icon} size={16} color={Colors.bgPrimary} />}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  );
}

function EmptyBlock({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={28} color={Colors.textMuted} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  loading: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  notice: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  noticeText: {
    flex: 1,
    gap: Spacing.xs,
  },
  noticeTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  noticeBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  steps: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  step: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
    minHeight: 56,
  },
  stepActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  stepNumActive: {
    backgroundColor: Colors.accent,
  },
  stepNumText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  stepNumTextActive: {
    color: Colors.bgPrimary,
  },
  stepText: {
    flex: 1,
    minWidth: 0,
  },
  stepLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  stepLabelActive: {
    color: Colors.text,
  },
  stepMeta: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  introText: {
    flex: 1,
    minWidth: 0,
  },
  introTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  introBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 2,
    maxWidth: 560,
  },
  floorGrid: {
    gap: Spacing.md,
  },
  floorGridTwoUp: {
    flexDirection: 'row',
  },
  floorCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
  },
  floorCardTwoUp: {
    flex: 1,
  },
  floorInfo: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  floorTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  areaRow: {
    alignSelf: 'stretch',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: -Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  areaRowPressed: {
    backgroundColor: Colors.bgElevated,
  },
  areaName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  areaMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  muted: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  planThumb: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.bgSecondary,
  },
  planThumbLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    backgroundColor: '#f472b6',
  },
  floorSize: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  floorTip: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    lineHeight: 17,
  },
  floorAction: {
    marginTop: Spacing.sm,
  },
  thumbMissing: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  chips: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    padding: CARD_PAD,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
  },
  cardPressed: {
    borderColor: Colors.accent,
  },
  thumb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgPrimary,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  cardName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  cardMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  cardCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  overPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  overPillText: {
    fontSize: FontSize.xxs,
    fontWeight: '600',
    color: Colors.warning,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 420,
  },
  library: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
    overflow: 'hidden',
  },
  pieceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pieceRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  pieceMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    minHeight: 60,
  },
  pieceMainPressed: {
    backgroundColor: Colors.bgElevated,
  },
  pieceText: {
    flex: 1,
    minWidth: 0,
  },
  pieceName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  pieceMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  qty: {
    alignItems: 'flex-end',
  },
  qtyValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  qtyLabel: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowAction: {
    width: 52,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
  },
  rowActionPressed: {
    backgroundColor: Colors.bgElevated,
  },
});
