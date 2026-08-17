import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import MediaRow from '@/components/ui/MediaRow';
import { EquipmentBox } from '@/features/equipment/components/EquipmentTagging';
import LocationZonePicker from '@/features/locations/components/LocationZonePicker';
import { getLocationLabel } from '@/features/locations/zones';
import type { MediaItem, TaskEquipmentRef } from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export interface ItemDraft {
  id: string;
  title: string;
  description: string;
  item_type: string | null;
  media: MediaItem[];
  location_from: string | null;
  location_to: string | null;
  equipment: TaskEquipmentRef[];
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
  onSetEquipmentPlacement: (
    equipmentId: string,
    field: 'from' | 'to',
    zoneId: string | null,
  ) => void;
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
  onSetEquipmentPlacement,
  onAddImage,
  onRemoveImage,
  onEditEquipment,
  onMove,
  onRemove,
}: ItemEditorCardProps) {
  // New (blank) items open for editing; items that already have a title start
  // collapsed so long lists stay scannable.
  const [expanded, setExpanded] = useState(() => !item.title.trim());
  const equipmentLabels = item.equipment.map(
    (ref) => equipmentById.get(ref.id) ?? 'Unknown',
  );

  const summaryParts: string[] = [];
  if (item.media.length > 0) {
    summaryParts.push(`${item.media.length} photo${item.media.length === 1 ? '' : 's'}`);
  }
  if (equipmentLabels.length > 0) {
    summaryParts.push(`${equipmentLabels.length} equipment`);
  }
  const routedCount = item.equipment.filter((ref) => ref.from || ref.to).length;
  if (routedCount > 0) {
    summaryParts.push(`${routedCount} routed`);
  }
  if (item.location_from && item.location_to) {
    summaryParts.push(
      `${getLocationLabel(item.location_from)} → ${getLocationLabel(item.location_to)}`,
    );
  } else if (item.location_from || item.location_to) {
    summaryParts.push(getLocationLabel((item.location_from ?? item.location_to)!));
  }

  return (
    <Card style={s.itemCard}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerMain}
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse item' : 'Expand item'}
          activeOpacity={0.7}
        >
          <View style={s.numberChip}>
            <Text style={s.numberText}>{index + 1}</Text>
          </View>
          <View style={s.headerText}>
            <Text
              style={[s.headerTitle, !item.title.trim() && s.headerUntitled]}
              numberOfLines={1}
            >
              {item.title.trim() || 'New task'}
            </Text>
            {!expanded && summaryParts.length > 0 && (
              <Text style={s.headerSummary} numberOfLines={1}>
                {summaryParts.join('  ·  ')}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={s.controls}>
          <TouchableOpacity
            onPress={() => onMove('up')}
            disabled={index === 0}
            style={s.ctrlBtn}
            accessibilityLabel="Move up"
          >
            <Ionicons
              name="arrow-up"
              size={16}
              color={index === 0 ? Colors.border : Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onMove('down')}
            disabled={index === count - 1}
            style={s.ctrlBtn}
            accessibilityLabel="Move down"
          >
            <Ionicons
              name="arrow-down"
              size={16}
              color={index === count - 1 ? Colors.border : Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} style={s.ctrlBtn} accessibilityLabel="Remove item">
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setExpanded((e) => !e)}
            style={s.ctrlBtn}
            accessibilityLabel={expanded ? 'Collapse' : 'Expand'}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {expanded && (
        <View style={s.body}>
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

          <Text style={s.fieldLabel}>Photos</Text>
          <MediaRow
            media={item.media}
            uploading={uploading}
            onAdd={onAddImage}
            onRemove={onRemoveImage}
          />

          <Text style={s.fieldLabel}>Equipment</Text>
          <EquipmentBox labels={equipmentLabels} onPress={onEditEquipment} />

          {item.equipment.map((ref) => (
            <View key={ref.id} style={s.placementCard}>
              <Text style={s.placementName}>
                {equipmentById.get(ref.id) ?? 'Unknown equipment'}
              </Text>
              <LocationZonePicker
                label="Get it from"
                value={ref.from}
                onChange={(z) => onSetEquipmentPlacement(ref.id, 'from', z)}
              />
              <LocationZonePicker
                label="Put it back / take it to"
                value={ref.to}
                onChange={(z) => onSetEquipmentPlacement(ref.id, 'to', z)}
              />
              <Text style={s.placementHint}>
                Leave a zone blank to use the task&apos;s own from/to below.
              </Text>
            </View>
          ))}

          <Text style={s.fieldLabel}>Task locations</Text>
          <LocationZonePicker
            label="From location"
            value={item.location_from}
            onChange={(z) => onSetLocation('location_from', z)}
          />
          <LocationZonePicker
            label="To location"
            value={item.location_to}
            onChange={(z) => onSetLocation('location_to', z)}
          />
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  itemCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 0,
    minHeight: 36,
  },
  numberChip: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  numberText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  headerUntitled: {
    color: Colors.textMuted,
    fontWeight: '500',
  },
  headerSummary: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  ctrlBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: Spacing.md,
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
  placementCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  placementName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  placementHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
