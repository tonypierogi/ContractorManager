import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import MediaRow from '@/components/ui/MediaRow';
import EquipmentModeSection from '@/features/equipment/components/EquipmentModeSection';
import EquipmentPickerSheet from '@/features/equipment/components/EquipmentPickerSheet';
import { equipmentModes, type EquipmentHomeZones } from '@/features/equipment/refs';
import type { PhotoSource } from '@/lib/photo-picker';
import type {
  Equipment,
  EquipmentLinkMode,
  MediaItem,
  SopItemType,
  TaskEquipmentRef,
} from '@/types/database';
import { Colors, Spacing, FontSize } from '@/constants/theme';

interface SheetItem {
  title: string;
  description: string;
  item_type: SopItemType;
  media: MediaItem[];
  equipment: TaskEquipmentRef[];
}

interface Props {
  /** The item being edited; null closes the sheet. */
  item: SheetItem | null;
  /** Position in the SOP, for the sheet's subtitle. */
  index: number;
  equipment: Equipment[] | undefined;
  /** equipment id -> display name */
  equipmentById: Map<string, string>;
  /** equipment id -> the room it lives in, pre-filled into its zone picker. */
  equipmentHomes: EquipmentHomeZones;
  uploading: boolean;
  onUpdateField: (field: 'title' | 'description', value: string) => void;
  onSetEquipmentPlacement: (
    equipmentId: string,
    field: 'from' | 'to',
    zoneId: string | null,
  ) => void;
  onSetEquipmentMode: (equipmentId: string, mode: EquipmentLinkMode) => void;
  onToggleEquipment: (equipmentId: string, mode: EquipmentLinkMode) => void;
  onRemoveEquipment: (equipmentId: string) => void;
  onAddImage: (source: PhotoSource) => void;
  onRemoveImage: (mediaIndex: number) => void;
  onClose: () => void;
}

/**
 * Editing one SOP item, in a sheet over the list. The equipment picker is a
 * second sheet mounted after this one, so it stacks on top of the sheet that
 * asked for it rather than being laid out inside its scrolling body.
 */
export default function SopItemEditorSheet({
  item,
  index,
  equipment,
  equipmentById,
  equipmentHomes,
  uploading,
  onUpdateField,
  onSetEquipmentPlacement,
  onSetEquipmentMode,
  onToggleEquipment,
  onRemoveEquipment,
  onAddImage,
  onRemoveImage,
  onClose,
}: Props) {
  const [pickerMode, setPickerMode] = useState<EquipmentLinkMode | null>(null);
  const isSection = item?.item_type === 'section';

  const close = () => {
    setPickerMode(null);
    onClose();
  };

  return (
    <>
      <Sheet
        visible={item != null}
        onClose={close}
        title={item?.title.trim() || (isSection ? 'New section' : 'New task')}
        subtitle={`${isSection ? 'Section' : 'Task'} ${index + 1}`}
      >
        {item ? (
          <>
            <Input
              placeholder="Title"
              value={item.title}
              onChangeText={(v) => onUpdateField('title', v)}
            />
            <Input
              placeholder="Description (optional)"
              value={item.description}
              onChangeText={(v) => onUpdateField('description', v)}
              multiline
              minHeight={72}
            />

            {!isSection && (
              <>
                <Text style={s.fieldLabel}>Images</Text>
                <MediaRow
                  media={item.media}
                  uploading={uploading}
                  onAddFromCamera={() => onAddImage('camera')}
                  onAddFromLibrary={() => onAddImage('library')}
                  onRemove={onRemoveImage}
                />

                {(['use', 'return'] as EquipmentLinkMode[]).map((mode) => (
                  <EquipmentModeSection
                    key={mode}
                    mode={mode}
                    refs={item.equipment}
                    equipmentById={equipmentById}
                    homeZones={equipmentHomes}
                    onAdd={() => setPickerMode(mode)}
                    onSetPlacement={onSetEquipmentPlacement}
                    onSetMode={onSetEquipmentMode}
                    onRemove={onRemoveEquipment}
                  />
                ))}
                {item.equipment.length > 0 ? (
                  <Text style={s.placementHint}>
                    Each item&apos;s room and photo are filled in from the Equipment
                    screen; change either if this step is different.
                  </Text>
                ) : null}
              </>
            )}

            <View style={s.doneRow}>
              <Button title="Done" onPress={close} fullWidth />
            </View>
          </>
        ) : null}
      </Sheet>

      <EquipmentPickerSheet
        mode={item ? pickerMode : null}
        equipment={equipment}
        selected={equipmentModes(item?.equipment ?? [])}
        onToggle={onToggleEquipment}
        onClose={() => setPickerMode(null)}
      />
    </>
  );
}

const s = StyleSheet.create({
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  placementHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  doneRow: {
    marginTop: Spacing.md,
  },
});
