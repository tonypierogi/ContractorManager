import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  type GestureResponderHandlers,
} from 'react-native';
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
  /** Position among the tasks, sections skipped; null for a section row. */
  number?: number | null;
  /** Open this item in the editing sheet. */
  onOpen: () => void;
  /** Spread onto the grip so the list can drag this row. */
  dragHandlers?: GestureResponderHandlers;
  dragging?: boolean;
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
  number,
  onOpen,
  dragHandlers,
  dragging,
}: SopItemCardProps) {
  const isSection = item.item_type === 'section';
  // The first photo stands in for the task — far faster to recognise than a
  // truncated title when you are scanning a long list.
  const thumb = item.media.find((m) => m.type === 'image')?.url ?? null;
  const summaryParts: string[] = [];
  if (item.media.length > 0) {
    summaryParts.push(`${item.media.length} photo${item.media.length === 1 ? '' : 's'}`);
  }
  const toGet = refsForMode(item.equipment, 'use').length;
  const toBring = refsForMode(item.equipment, 'return').length;
  if (toGet > 0) summaryParts.push(`${toGet} to get`);
  if (toBring > 0) summaryParts.push(`${toBring} to bring`);

  return (
    <Card style={[s.itemCard, dragging && s.dragging]}>
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
          {thumb ? <Image source={{ uri: thumb }} style={s.thumb} /> : null}
          <View style={s.headerText}>
            <Text
              style={[
                s.headerTitle,
                isSection && s.sectionTitle,
                !item.title.trim() && s.headerUntitled,
              ]}
              numberOfLines={2}
            >
              {item.title.trim() || (isSection ? 'New section' : 'New task')}
            </Text>
            {summaryParts.length > 0 && (
              <Text style={s.headerSummary}>{summaryParts.join('  ·  ')}</Text>
            )}
          </View>
        </TouchableOpacity>
        {/* Edit above, drag below: the two things you do to a row, stacked
            clear of the title so it can run the full width of the card. */}
        <View style={s.sideCol}>
          <TouchableOpacity
            onPress={onOpen}
            style={s.ctrlBtn}
            accessibilityLabel={`Edit ${item.title.trim() || 'this item'}`}
          >
            <Ionicons name="pencil" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View
            style={s.grip}
            {...(dragHandlers ?? {})}
            accessibilityLabel={
              isSection
                ? `Drag ${item.title.trim() || 'section'} to reorder, hold to drag it with its tasks`
                : `Drag ${item.title.trim() || 'item'} to reorder, hold to move it to a section`
            }
          >
            <Ionicons name="reorder-two" size={18} color={Colors.textMuted} />
          </View>
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
  dragging: {
    borderColor: Colors.accent,
    transform: [{ scale: 1.02 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  grip: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sideCol: {
    alignItems: 'center',
    flexShrink: 0,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
    flexShrink: 0,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
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
    lineHeight: 19,
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
  ctrlBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
