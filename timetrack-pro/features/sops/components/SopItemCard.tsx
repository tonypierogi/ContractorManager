import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import { refsForMode } from '@/features/equipment/refs';
import type { MediaItem, SopItemType, TaskEquipmentRef } from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface SopItemCardProps {
  item: {
    title: string;
    item_type: SopItemType;
    media: MediaItem[];
    equipment: TaskEquipmentRef[];
  };
  index: number;
  count: number;
  /** Open this item in the editing sheet. */
  onOpen: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
}

/**
 * One collapsed row of the SOP being edited. Same shape as the task-list
 * editor's row: the list stays scannable and reorderable, and editing happens
 * in a sheet on top of it.
 */
export default function SopItemCard({
  item,
  index,
  count,
  onOpen,
  onMove,
  onRemove,
}: SopItemCardProps) {
  const isSection = item.item_type === 'section';
  const summaryParts: string[] = [];
  if (item.media.length > 0) {
    summaryParts.push(`${item.media.length} photo${item.media.length === 1 ? '' : 's'}`);
  }
  const toGet = refsForMode(item.equipment, 'use').length;
  const toBring = refsForMode(item.equipment, 'return').length;
  if (toGet > 0) summaryParts.push(`${toGet} to get`);
  if (toBring > 0) summaryParts.push(`${toBring} to bring`);

  return (
    <Card style={s.itemCard}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerMain}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.title.trim() || (isSection ? 'new section' : 'new task')}`}
          activeOpacity={0.7}
        >
          <View style={[s.typeBadge, isSection && s.sectionBadge]}>
            <Text style={[s.typeText, isSection && s.sectionText]}>
              {isSection ? 'Section' : 'Task'}
            </Text>
          </View>
          <View style={s.headerText}>
            <Text
              style={[s.headerTitle, !item.title.trim() && s.headerUntitled]}
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
          <TouchableOpacity
            onPress={onRemove}
            style={s.ctrlBtn}
            accessibilityLabel="Remove item"
          >
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpen} style={s.ctrlBtn} accessibilityLabel="Edit item">
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
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent + '20',
    flexShrink: 0,
  },
  sectionBadge: {
    backgroundColor: Colors.warning + '20',
  },
  typeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  sectionText: {
    color: Colors.warning,
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
});
