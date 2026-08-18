import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import { refsForMode } from '@/features/equipment/refs';
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

export const makeDraft = (itemType: 'task' | 'section' = 'task'): ItemDraft => ({
  id: `draft-${++nextId}`,
  title: '',
  description: '',
  item_type: itemType,
  media: [],
  location_from: null,
  location_to: null,
  equipment: [],
  video_timestamp: null,
});

/** The one-line gist of a collapsed item: photos, gear, and where it travels. */
export function itemSummary(item: ItemDraft): string[] {
  const parts: string[] = [];
  if (item.media.length > 0) {
    parts.push(`${item.media.length} photo${item.media.length === 1 ? '' : 's'}`);
  }
  const toGet = refsForMode(item.equipment, 'use').length;
  const toBring = refsForMode(item.equipment, 'return').length;
  if (toGet > 0) parts.push(`${toGet} to get`);
  if (toBring > 0) parts.push(`${toBring} to bring`);
  const routed = item.equipment.filter((ref) => ref.from || ref.to).length;
  if (routed > 0) parts.push(`${routed} routed`);
  if (item.location_from && item.location_to) {
    parts.push(
      `${getLocationLabel(item.location_from)} → ${getLocationLabel(item.location_to)}`,
    );
  } else if (item.location_from || item.location_to) {
    parts.push(getLocationLabel((item.location_from ?? item.location_to)!));
  }
  return parts;
}

interface ItemEditorCardProps {
  item: ItemDraft;
  index: number;
  /** Position among the tasks, sections skipped; null for a section row. */
  number: number | null;
  count: number;
  /** Open this item in the editing sheet. */
  onOpen: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
}

/**
 * One collapsed row in the list being edited. Editing happens in a sheet on
 * top of the list (ItemEditorSheet) rather than inline, so a fifty-task list
 * stays a list you can scan and reorder instead of a wall of open forms.
 */
export default function ItemEditorCard({
  item,
  index,
  number,
  count,
  onOpen,
  onMove,
  onRemove,
}: ItemEditorCardProps) {
  const isSection = item.item_type === 'section';
  const summaryParts = isSection ? [] : itemSummary(item);

  return (
    <Card style={isSection ? s.sectionCard : s.itemCard}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerMain}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.title.trim() || (isSection ? 'new section' : 'new task')}`}
          activeOpacity={0.7}
        >
          <View style={[s.numberChip, isSection && s.sectionChip]}>
            {isSection ? (
              <Ionicons name="bookmark-outline" size={13} color={Colors.warning} />
            ) : (
              <Text style={s.numberText}>{number ?? index + 1}</Text>
            )}
          </View>
          <View style={s.headerText}>
            <Text
              style={[
                s.headerTitle,
                isSection && s.sectionTitle,
                !item.title.trim() && s.headerUntitled,
              ]}
              numberOfLines={1}
            >
              {item.title.trim() || (isSection ? 'New section' : 'New task')}
            </Text>
            {summaryParts.length > 0 && (
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
            onPress={onOpen}
            style={s.ctrlBtn}
            accessibilityLabel="Edit item"
          >
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  itemCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  sectionCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.bgElevated,
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
  sectionChip: {
    backgroundColor: Colors.warning + '20',
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
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Colors.warning,
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
});
