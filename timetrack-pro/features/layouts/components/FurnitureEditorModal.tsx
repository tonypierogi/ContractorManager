import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import DimensionField from '@/features/layouts/components/DimensionField';
import PieceBody from '@/features/layouts/components/PieceBody';
import {
  useDeleteFurniturePiece,
  useSaveFurniturePiece,
  useUploadFurniturePhoto,
} from '@/features/layouts/hooks';
import { useAuth } from '@/features/auth/auth-provider';
import { pickPhotoAsset, type PhotoSource } from '@/lib/photo-picker';
import {
  DEFAULT_PIECE_COLOR,
  PIECE_COLORS,
  describePiece,
} from '@/features/layouts/geometry';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { FurniturePiece, FurnitureShape } from '@/types/database';

interface Props {
  visible: boolean;
  /** null = add a new piece; otherwise edit this one. */
  piece: FurniturePiece | null;
  /** How many saved layouts place this piece — shown before a delete. */
  usedInLayouts?: number;
  onClose: () => void;
  /** Called with the saved piece, e.g. so a picker can place it straight away. */
  onSaved?: (piece: FurniturePiece) => void;
  /**
   * Called with the new copy after Duplicate. The parent should switch the
   * editor to it, so the copy can be renamed or resized straight away.
   */
  onDuplicated?: (copy: FurniturePiece) => void;
}

/** Common rental and banquet sizes, to fill the form in one tap. */
const PRESETS: { name: string; shape: FurnitureShape; w: number; d: number; arm?: number }[] = [
  { name: '6′ banquet table', shape: 'rect', w: 72, d: 30 },
  { name: '8′ banquet table', shape: 'rect', w: 96, d: 30 },
  { name: '60″ round table', shape: 'round', w: 60, d: 60 },
  { name: '72″ round table', shape: 'round', w: 72, d: 72 },
  { name: 'Cocktail table', shape: 'round', w: 30, d: 30 },
  { name: 'Folding chair', shape: 'rect', w: 18, d: 18 },
  { name: 'Stage deck 4′×8′', shape: 'rect', w: 96, d: 48 },
  { name: 'L sectional sofa', shape: 'l', w: 108, d: 84, arm: 36 },
  { name: 'L-shaped desk', shape: 'l', w: 60, d: 60, arm: 24 },
];

const SHAPES: { key: FurnitureShape; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'rect', label: 'Rectangle', icon: 'square-outline' },
  { key: 'round', label: 'Round', icon: 'ellipse-outline' },
  { key: 'l', label: 'L-shape', icon: 'return-down-forward-outline' },
];

/** Add or edit one piece in the furniture library. */
export default function FurnitureEditorModal({
  visible,
  piece,
  usedInLayouts = 0,
  onClose,
  onSaved,
  onDuplicated,
}: Props) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const save = useSaveFurniturePiece();
  const remove = useDeleteFurniturePiece();
  const upload = useUploadFurniturePhoto();

  const [name, setName] = useState('');
  const [shape, setShape] = useState<FurnitureShape>('rect');
  const [width, setWidth] = useState<number | null>(null);
  const [depth, setDepth] = useState<number | null>(null);
  const [arm, setArm] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('');
  const [color, setColor] = useState(DEFAULT_PIECE_COLOR);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(piece?.name ?? '');
    setShape(piece?.shape ?? 'rect');
    setWidth(piece?.width_in ?? null);
    setDepth(piece?.depth_in ?? null);
    setArm(piece?.arm_in ?? null);
    setQuantity(piece?.quantity != null ? String(piece.quantity) : '');
    setColor(piece?.color ?? DEFAULT_PIECE_COLOR);
    setPhotoUrl(piece?.photo_url ?? null);
    setNotes(piece?.notes ?? '');
    setShowErrors(false);
    setConfirmingDelete(false);
  }, [visible, piece]);

  const nameError = !name.trim() ? 'Give the piece a name' : undefined;
  const widthError = !width ? 'Enter a width' : undefined;
  const depthError = !depth ? 'Enter a depth' : undefined;
  const isL = shape === 'l';
  const armError = !isL
    ? undefined
    : !arm
      ? 'Enter how deep each arm is'
      : (width && arm >= width) || (depth && arm >= depth)
        ? 'The arms must be shallower than the overall width and depth'
        : undefined;
  const valid = !nameError && !widthError && !depthError && !armError;

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setName(preset.name);
    setShape(preset.shape);
    setWidth(preset.w);
    setDepth(preset.d);
    setArm(preset.arm ?? null);
  };

  /** The form as a save payload, or null (with errors shown) if incomplete. */
  const formValues = () => {
    if (!valid || !width || !depth) {
      setShowErrors(true);
      return null;
    }
    const qty = quantity.trim() ? parseInt(quantity, 10) : null;
    return {
      name,
      shape,
      width_in: width,
      depth_in: depth,
      arm_in: isL ? arm : null,
      quantity: qty != null && Number.isFinite(qty) ? qty : null,
      color,
      photo_url: photoUrl,
      notes: notes.trim() || null,
    };
  };

  // Uploads straight away on picking, like the equipment editor, so Save
  // only ever writes a URL that already exists.
  const handlePhoto = async (source: PhotoSource) => {
    if (!user) return;
    const asset = await pickPhotoAsset(source, {
      onCameraDenied: () => showToast('Camera access denied — upload from your library instead', 'error'),
    });
    if (!asset) return;
    try {
      const url = await upload.mutateAsync({
        userId: user.id,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      setPhotoUrl(url);
    } catch {
      // surfaced by the global mutation error toast
    }
  };

  // A copy of what's in the form now — the usual way to add a near-identical
  // piece: an 8′ table from the 6′ one, a high-top from the cocktail table.
  const handleDuplicate = async () => {
    const values = formValues();
    if (!values) return;
    try {
      const copy = await save.mutateAsync({ ...values, name: `${values.name.trim()} (copy)` });
      showToast('Copy added — rename or resize it here');
      onDuplicated?.(copy);
    } catch {
      // surfaced by the global mutation error toast
    }
  };

  const handleSave = async () => {
    const values = formValues();
    if (!values) return;
    try {
      const saved = await save.mutateAsync({ id: piece?.id, ...values });
      showToast(piece ? 'Piece updated' : 'Piece added');
      onSaved?.(saved);
      onClose();
    } catch {
      // surfaced by the global mutation error toast
    }
  };

  const handleDelete = async () => {
    if (!piece) return;
    try {
      await remove.mutateAsync(piece.id);
      showToast('Piece deleted');
      onClose();
    } catch {
      // surfaced by the global mutation error toast
    }
  };

  // Preview at the piece's own proportions, fitted into a 72pt box.
  const previewScale = width && depth ? 72 / Math.max(width, depth) : 0;

  return (
    <Modal visible={visible} onClose={onClose} title={piece ? 'Edit piece' : 'Add furniture'}>
      {!piece ? (
        <View style={s.presetBlock}>
          <Text style={s.sectionLabel}>Start from a common size</Text>
          <View style={s.chipRow}>
            {PRESETS.map((preset) => (
              <Pressable
                key={preset.name}
                onPress={() => applyPreset(preset)}
                style={({ pressed }) => [s.chip, pressed && s.chipPressed]}
                accessibilityRole="button"
              >
                <Text style={s.chipText}>{preset.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Input
        label="Name"
        placeholder="e.g. 6′ banquet table"
        value={name}
        onChangeText={setName}
        error={showErrors ? nameError : undefined}
      />

      <Text style={s.sectionLabel}>Photo</Text>
      {photoUrl ? (
        <View style={s.photoRow}>
          <Image source={{ uri: photoUrl }} style={s.photo} resizeMode="cover" />
          <View style={s.photoActions}>
            <View style={s.photoButtons}>
              <Button
                title="Retake"
                variant="secondary"
                size="sm"
                icon={<Ionicons name="camera-outline" size={16} color={Colors.text} />}
                onPress={() => handlePhoto('camera')}
                loading={upload.isPending}
              />
              <Button
                title="Upload"
                variant="secondary"
                size="sm"
                icon={<Ionicons name="image-outline" size={16} color={Colors.text} />}
                onPress={() => handlePhoto('library')}
                loading={upload.isPending}
              />
            </View>
            <Pressable
              onPress={() => setPhotoUrl(null)}
              accessibilityRole="button"
              style={({ pressed }) => [s.deleteLink, s.removePhoto, pressed && s.deleteLinkPressed]}
            >
              <Ionicons name="close-circle-outline" size={15} color={Colors.danger} />
              <Text style={s.deleteLinkText}>Remove photo</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={s.photoButtons}>
          <Button
            title="Take photo"
            size="sm"
            icon={<Ionicons name="camera" size={16} color={Colors.bgPrimary} />}
            onPress={() => handlePhoto('camera')}
            loading={upload.isPending}
          />
          <Button
            title="Upload photo"
            variant="secondary"
            size="sm"
            icon={<Ionicons name="image-outline" size={16} color={Colors.text} />}
            onPress={() => handlePhoto('library')}
            loading={upload.isPending}
          />
        </View>
      )}
      <View style={s.photoGap} />

      <Text style={s.sectionLabel}>Shape</Text>
      <View style={s.segment}>
        {SHAPES.map((option) => {
          const active = shape === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setShape(option.key)}
              style={[s.segmentOption, active && s.segmentOptionActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={option.icon}
                size={16}
                color={active ? Colors.accent : Colors.textSecondary}
              />
              <Text style={[s.segmentText, active && s.segmentTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.dimRow}>
        <DimensionField
          label="Width"
          value={width}
          onChange={setWidth}
          error={showErrors ? widthError : undefined}
        />
        <DimensionField
          label="Depth"
          value={depth}
          onChange={setDepth}
          error={showErrors ? depthError : undefined}
        />
      </View>
      {isL ? (
        <>
          <View style={s.dimRow}>
            <DimensionField
              label="Arm depth"
              value={arm}
              onChange={setArm}
              error={showErrors ? armError : undefined}
            />
            <View style={s.dimSpacer} />
          </View>
          <Text style={s.armHint}>
            Width and depth are the whole L, end to end. Arm depth is how deep each arm is — a
            sofa’s seat, a desk’s top. Turn and mirror it in the layout to face any corner.
          </Text>
        </>
      ) : null}

      {width && depth ? (
        <View style={s.preview}>
          <View style={s.previewBox}>
            <PieceBody
              shape={shape}
              width={width * previewScale}
              height={depth * previewScale}
              arm={arm ? arm * previewScale : undefined}
              fill={isL ? color : color + 'b3'}
              borderColor={color}
              borderWidth={1}
            />
          </View>
          <Text style={s.previewText}>
            {describePiece({ shape, width_in: width, depth_in: depth, arm_in: isL ? arm : null })}
          </Text>
        </View>
      ) : null}

      <Text style={s.sectionLabel}>Colour on the plan</Text>
      <View style={s.swatchRow}>
        {PIECE_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${c}`}
            accessibilityState={{ selected: color === c }}
            style={[s.swatch, { backgroundColor: c }, color === c && s.swatchActive]}
          >
            {color === c ? <Ionicons name="checkmark" size={16} color="#0a0f1a" /> : null}
          </Pressable>
        ))}
      </View>

      <Text style={s.sectionLabel}>How many we own</Text>
      <View style={s.qtyRow}>
        <TextInput
          value={quantity}
          onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="Not tracked"
          placeholderTextColor={Colors.textMuted}
          style={s.qtyInput}
          maxLength={5}
        />
        <Text style={s.qtyHint}>Layouts that use more than this get flagged.</Text>
      </View>

      <Input
        label="Notes"
        placeholder="Where it's stored, how to set it up…"
        value={notes}
        onChangeText={setNotes}
        multiline
        minHeight={64}
      />

      <Button title={piece ? 'Save piece' : 'Add piece'} onPress={handleSave} loading={save.isPending} fullWidth />

      {piece ? (
        confirmingDelete ? (
          <View style={s.confirm}>
            <Text style={s.confirmText}>
              {usedInLayouts > 0
                ? `Delete “${piece.name}”? It's placed in ${usedInLayouts} saved ${
                    usedInLayouts === 1 ? 'layout' : 'layouts'
                  } and will disappear from ${usedInLayouts === 1 ? 'it' : 'them'}.`
                : `Delete “${piece.name}” from the library?`}
            </Text>
            <View style={s.confirmActions}>
              <Button title="Keep it" variant="secondary" size="sm" onPress={() => setConfirmingDelete(false)} />
              <Button title="Delete piece" variant="danger" size="sm" onPress={handleDelete} loading={remove.isPending} />
            </View>
          </View>
        ) : (
          <View style={s.secondaryRow}>
            <Button
              title="Duplicate"
              variant="secondary"
              size="sm"
              icon={<Ionicons name="copy-outline" size={16} color={Colors.text} />}
              onPress={handleDuplicate}
              disabled={save.isPending}
            />
            <Pressable
              onPress={() => setConfirmingDelete(true)}
              accessibilityRole="button"
              style={({ pressed }) => [s.deleteLink, pressed && s.deleteLinkPressed]}
            >
              <Ionicons name="trash-outline" size={15} color={Colors.danger} />
              <Text style={s.deleteLinkText}>Delete piece</Text>
            </Pressable>
          </View>
        )
      ) : null}
    </Modal>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetBlock: {
    marginBottom: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
  },
  chip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  chipPressed: {
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontWeight: '500',
  },
  segment: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  segmentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
  },
  segmentOptionActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentGlow,
  },
  segmentText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.accent,
  },
  dimRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dimSpacer: {
    flex: 1,
  },
  armHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 17,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  previewBox: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: Colors.text,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  qtyInput: {
    width: 110,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.md,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  qtyHint: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoActions: {
    flex: 1,
    gap: Spacing.xs,
    alignItems: 'flex-start',
  },
  photoButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  removePhoto: {
    minHeight: 36,
  },
  photoGap: {
    height: Spacing.md,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
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
  confirm: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    gap: Spacing.sm,
  },
  confirmText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
});
