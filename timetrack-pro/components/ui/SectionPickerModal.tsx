import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '@/components/ui/Modal';
import { Colors, Spacing, FontSize } from '@/constants/theme';

export interface SectionChoice {
  id: string;
  title: string;
  /** How many tasks currently sit under it. */
  taskCount: number;
}

interface SectionPickerModalProps {
  visible: boolean;
  /** The task being moved, for the prompt. */
  itemTitle: string;
  sections: SectionChoice[];
  /** null moves the task above the first section. */
  onPick: (sectionId: string | null) => void;
  onClose: () => void;
}

/**
 * Reached by holding a row's up/down arrow: instead of stepping a task past
 * one neighbour at a time, jump it to the end of whichever section you tap.
 *
 * Shared by the task-list and SOP editors — both build the same section rows.
 */
export default function SectionPickerModal({
  visible,
  itemTitle,
  sections,
  onPick,
  onClose,
}: SectionPickerModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title="Move to section">
      <Text style={s.prompt} numberOfLines={2}>
        Move &ldquo;{itemTitle || 'this task'}&rdquo; to:
      </Text>

      <TouchableOpacity
        style={s.row}
        onPress={() => onPick(null)}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-up-circle-outline" size={18} color={Colors.textSecondary} />
        <Text style={s.rowTitle}>Top of the list</Text>
      </TouchableOpacity>

      {sections.length === 0 ? (
        <Text style={s.empty}>
          This list has no sections yet — add one with the New Section button.
        </Text>
      ) : (
        sections.map((section) => (
          <TouchableOpacity
            key={section.id}
            style={s.row}
            onPress={() => onPick(section.id)}
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Ionicons name="bookmark-outline" size={18} color={Colors.accent} />
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>{section.title}</Text>
              <Text style={s.rowMeta}>
                {section.taskCount} task{section.taskCount === 1 ? '' : 's'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ))
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  prompt: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  rowMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
});
