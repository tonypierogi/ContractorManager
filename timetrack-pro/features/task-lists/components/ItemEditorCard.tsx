import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import MediaRow from '@/components/ui/MediaRow';
import { EquipmentBox } from '@/features/equipment/components/EquipmentTagging';
import LocationZonePicker from '@/features/locations/components/LocationZonePicker';
import type { MediaItem } from '@/types/database';
import { Colors, Spacing, FontSize } from '@/constants/theme';

export interface ItemDraft {
  id: string;
  title: string;
  description: string;
  item_type: string | null;
  media: MediaItem[];
  location_from: string | null;
  location_to: string | null;
  equipment: string[];
  video_timestamp: number | null;
}

let nextId = 0;

export const makeDraft = (): ItemDraft => ({
  id: `draft-${++nextId}`,
  title: '',
  description: '',
  item_type: 'task',
  media: [],
  location_from: null,
  location_to: null,
  equipment: [],
  video_timestamp: null,
});

interface ItemEditorCardProps {
  item: ItemDraft;
  index: number;
  count: number;
  /** equipment id -> display name */
  equipmentById: Map<string, string>;
  uploading: boolean;
  onUpdateField: (field: 'title' | 'description', value: string) => void;
  onSetLocation: (field: 'location_from' | 'location_to', zoneId: string | null) => void;
  onAddImage: () => void;
  onRemoveImage: (mediaIndex: number) => void;
  onEditEquipment: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
}

export default function ItemEditorCard({
  item,
  index,
  count,
  equipmentById,
  uploading,
  onUpdateField,
  onSetLocation,
  onAddImage,
  onRemoveImage,
  onEditEquipment,
  onMove,
  onRemove,
}: ItemEditorCardProps) {
  const equipmentLabels = item.equipment.map((eqId) => equipmentById.get(eqId) ?? 'Unknown');

  return (
    <Card style={s.itemCard}>
      <View style={s.itemHeader}>
        <Text style={s.itemNumber}>#{index + 1}</Text>
        <View style={s.itemControls}>
          <TouchableOpacity
            onPress={() => onMove('up')}
            disabled={index === 0}
            style={s.arrowBtn}
          >
            <Text style={[s.arrow, index === 0 && s.arrowDisabled]}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onMove('down')}
            disabled={index === count - 1}
            style={s.arrowBtn}
          >
            <Text style={[s.arrow, index === count - 1 && s.arrowDisabled]}>↓</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove}>
            <Text style={s.removeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Input
        placeholder="Task title"
        value={item.title}
        onChangeText={(v) => onUpdateField('title', v)}
      />
      <Input
        placeholder="Description (optional)"
        value={item.description}
        onChangeText={(v) => onUpdateField('description', v)}
      />

      <Text style={s.fieldLabel}>Images</Text>
      <MediaRow
        media={item.media}
        uploading={uploading}
        onAdd={onAddImage}
        onRemove={onRemoveImage}
      />

      <Text style={s.fieldLabel}>Equipment</Text>
      <EquipmentBox labels={equipmentLabels} onPress={onEditEquipment} />

      <Text style={s.fieldLabel}>From location</Text>
      <LocationZonePicker
        value={item.location_from}
        onChange={(z) => onSetLocation('location_from', z)}
      />
      <Text style={s.fieldLabel}>To location</Text>
      <LocationZonePicker
        value={item.location_to}
        onChange={(z) => onSetLocation('location_to', z)}
      />
    </Card>
  );
}

const s = StyleSheet.create({
  itemCard: {
    marginBottom: Spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemNumber: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  arrowBtn: {
    padding: Spacing.xs,
  },
  arrow: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  arrowDisabled: {
    color: Colors.border,
  },
  removeBtn: {
    fontSize: FontSize.md,
    color: Colors.danger,
    padding: Spacing.xs,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
});
