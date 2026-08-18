import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  PanResponder,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AnnotationOverlay from '@/components/ui/AnnotationOverlay';
import { containRect, useImageAspectRatio } from '@/components/ui/AnnotatedImage';
import {
  ANNOTATION_COLORS,
  ANNOTATION_WIDTHS,
  clamp01,
  isEmptyAnnotation,
  newAnnotationId,
  shouldSamplePoint,
  type AnnotationKind,
  type AnnotationPoint,
  type AnnotationWidthName,
  type ImageAnnotation,
} from '@/lib/annotations';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface Props {
  visible: boolean;
  uri: string;
  /** Marks already on the photo; edited in place, saved on Done. */
  annotations: ImageAnnotation[];
  onSave: (annotations: ImageAnnotation[]) => void;
  onClose: () => void;
}

const TOOLS: { kind: AnnotationKind; label: string; icon: 'ellipse-outline' | 'brush' | 'arrow-forward' }[] = [
  { kind: 'ellipse', label: 'Circle', icon: 'ellipse-outline' },
  { kind: 'path', label: 'Draw', icon: 'brush' },
  { kind: 'arrow', label: 'Arrow', icon: 'arrow-forward' },
];

const WIDTH_CHOICES: { name: AnnotationWidthName; dot: number }[] = [
  { name: 'thin', dot: 6 },
  { name: 'medium', dot: 10 },
  { name: 'thick', dot: 14 },
];

/**
 * Full-screen "mark up this photo" editor: circle the part that matters,
 * point an arrow at it, or scribble freehand. The photo itself is never
 * touched — Done hands back the marks for the caller to store alongside it.
 */
export default function ImageAnnotator({
  visible,
  uri,
  annotations,
  onSave,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const aspectRatio = useImageAspectRatio(uri);

  const [strokes, setStrokes] = useState<ImageAnnotation[]>(annotations);
  const [draft, setDraft] = useState<ImageAnnotation | null>(null);
  const [tool, setTool] = useState<AnnotationKind>('ellipse');
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0]);
  const [widthName, setWidthName] = useState<AnnotationWidthName>('medium');
  const [box, setBox] = useState({ width: 0, height: 0 });

  // Re-seed from the caller each time the editor opens, so cancelling really
  // does discard everything drawn in the previous session.
  useEffect(() => {
    if (visible) {
      setStrokes(annotations);
      setDraft(null);
    }
  }, [visible, annotations]);

  const rect = containRect(box.width, box.height, aspectRatio);

  // The PanResponder is created once, so the live tool settings and canvas
  // size reach it through refs rather than a rebuilt closure.
  const rectRef = useRef(rect);
  rectRef.current = rect;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const widthRef = useRef(widthName);
  widthRef.current = widthName;
  const draftRef = useRef<ImageAnnotation | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Drawing owns the gesture outright: no parent scroll or lightbox
        // swipe gets to steal a stroke half-way through.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,

        onPanResponderGrant: (evt) => {
          const point = toNormalized(evt.nativeEvent, rectRef.current);
          if (!point) return;
          const stroke: ImageAnnotation = {
            id: newAnnotationId(),
            kind: toolRef.current,
            color: colorRef.current,
            width: ANNOTATION_WIDTHS[widthRef.current],
            points: [point, point],
          };
          draftRef.current = stroke;
          setDraft(stroke);
        },

        onPanResponderMove: (evt) => {
          const current = draftRef.current;
          if (!current) return;
          const point = toNormalized(evt.nativeEvent, rectRef.current);
          if (!point) return;

          const next: ImageAnnotation =
            current.kind === 'path'
              ? shouldSamplePoint(current.points[current.points.length - 1], point)
                ? { ...current, points: [...current.points, point] }
                : current
              : // Circles and arrows are defined by where the drag started and
                // where the finger is now — the middle of the drag is noise.
                { ...current, points: [current.points[0], point] };

          if (next === current) return;
          draftRef.current = next;
          setDraft(next);
        },

        onPanResponderRelease: () => {
          const finished = draftRef.current;
          draftRef.current = null;
          setDraft(null);
          if (!finished || isEmptyAnnotation(finished)) return;
          setStrokes((prev) => [...prev, finished]);
        },
        onPanResponderTerminate: () => {
          draftRef.current = null;
          setDraft(null);
        },
      }),
    [],
  );

  const undo = () => setStrokes((prev) => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text style={styles.headerAction}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Mark up photo</Text>
          <Pressable
            onPress={() => onSave(strokes)}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[styles.headerAction, styles.headerDone]}>Done</Text>
          </Pressable>
        </View>

        <View
          style={styles.canvas}
          onLayout={(e) =>
            setBox({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })
          }
        >
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          {rect.width > 0 && (
            <View
              style={{
                position: 'absolute',
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }}
              {...panResponder.panHandlers}
            >
              <AnnotationOverlay
                annotations={strokes}
                width={rect.width}
                height={rect.height}
                // Fade what's already down so the stroke in progress reads.
                opacity={draft ? 0.55 : 1}
              />
              {draft && (
                <AnnotationOverlay
                  annotations={[draft]}
                  width={rect.width}
                  height={rect.height}
                />
              )}
            </View>
          )}
        </View>

        <View style={[styles.toolbar, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <View style={styles.toolRow}>
            {TOOLS.map((entry) => {
              const active = tool === entry.kind;
              return (
                <Pressable
                  key={entry.kind}
                  onPress={() => setTool(entry.kind)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={entry.label}
                  style={[styles.toolButton, active && styles.toolButtonActive]}
                >
                  <Ionicons
                    name={entry.icon}
                    size={16}
                    color={active ? Colors.bgPrimary : Colors.text}
                  />
                  <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>
                    {entry.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.paletteRow}
          >
            {ANNOTATION_COLORS.map((swatch) => (
              <Pressable
                key={swatch}
                onPress={() => setColor(swatch)}
                accessibilityRole="button"
                accessibilityLabel={`Colour ${swatch}`}
                accessibilityState={{ selected: color === swatch }}
                style={[
                  styles.swatch,
                  { backgroundColor: swatch },
                  color === swatch && styles.swatchActive,
                ]}
              />
            ))}

            <View style={styles.separator} />

            {WIDTH_CHOICES.map((choice) => {
              const active = widthName === choice.name;
              return (
                <Pressable
                  key={choice.name}
                  onPress={() => setWidthName(choice.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`${choice.name} stroke`}
                  accessibilityState={{ selected: active }}
                  style={[styles.widthButton, active && styles.widthButtonActive]}
                >
                  <View
                    style={{
                      width: choice.dot,
                      height: choice.dot,
                      borderRadius: choice.dot / 2,
                      backgroundColor: color,
                    }}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.toolRow}>
            <Pressable
              onPress={undo}
              disabled={!strokes.length}
              accessibilityRole="button"
              style={[styles.toolButton, !strokes.length && styles.toolButtonDisabled]}
            >
              <Ionicons name="arrow-undo" size={16} color={Colors.text} />
              <Text style={styles.toolLabel}>Undo</Text>
            </Pressable>
            <Pressable
              onPress={clear}
              disabled={!strokes.length}
              accessibilityRole="button"
              style={[styles.toolButton, !strokes.length && styles.toolButtonDisabled]}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={[styles.toolLabel, { color: Colors.danger }]}>Clear</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Touch position as a 0..1 point on the photo. Returns null before the canvas
 * has been measured, when there is nothing to be relative to.
 */
function toNormalized(
  event: { locationX: number; locationY: number },
  rect: { width: number; height: number },
): AnnotationPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: clamp01(event.locationX / rect.width),
    y: clamp01(event.locationY / rect.height),
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  headerAction: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  headerDone: {
    color: Colors.accent,
  },
  canvas: {
    flex: 1,
    backgroundColor: '#05080e',
  },
  toolbar: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
  },
  toolRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toolButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
  },
  toolButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  toolButtonDisabled: {
    opacity: 0.4,
  },
  toolLabel: {
    color: Colors.text,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  toolLabelActive: {
    color: Colors.bgPrimary,
  },
  paletteRow: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: Colors.text,
    transform: [{ scale: 1.12 }],
  },
  separator: {
    width: 1,
    height: 24,
    marginHorizontal: Spacing.xs,
    backgroundColor: Colors.border,
  },
  widthButton: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPanel,
  },
  widthButtonActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.bgElevated,
  },
});
