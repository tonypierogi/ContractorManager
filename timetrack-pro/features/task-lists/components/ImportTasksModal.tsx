import { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import {
  parseImportedTasks,
  type ParsedImportItem,
} from '@/features/task-lists/import-text';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

/** Enough of the preview to trust the parse without scrolling forever. */
const PREVIEW_LIMIT = 25;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Append the parsed items to the list being edited. */
  onImport: (items: ParsedImportItem[]) => void;
}

/**
 * Paste notes, see what they turn into, add them. The preview is the whole
 * point: the parser guesses at sections and descriptions, so the guess is
 * shown before anything lands in the list.
 */
export default function ImportTasksModal({ visible, onClose, onImport }: Props) {
  const [text, setText] = useState('');

  const parsed = useMemo(() => parseImportedTasks(text), [text]);
  const taskCount = parsed.filter((it) => it.item_type === 'task').length;
  const sectionCount = parsed.length - taskCount;

  const close = () => {
    setText('');
    onClose();
  };

  const submit = () => {
    if (parsed.length === 0) return;
    onImport(parsed);
    setText('');
  };

  return (
    <Modal visible={visible} onClose={close} title="Import from notes" size="lg">
      <Text style={s.hint}>
        Paste your notes — one task per line. Bullets and numbering are stripped,
        a line ending in a colon (or a # heading) becomes a section, and an
        indented line becomes the description of the task above it.
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={'Kitchen:\n- Wipe counters\n- Mop floors: use the blue bucket\n\nBar:\n1. Restock garnishes'}
        placeholderTextColor={Colors.textMuted}
        style={s.textArea}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {parsed.length > 0 && (
        <>
          <Text style={s.count}>
            {taskCount} task{taskCount === 1 ? '' : 's'}
            {sectionCount > 0
              ? ` · ${sectionCount} section${sectionCount === 1 ? '' : 's'}`
              : ''}
          </Text>
          {parsed.slice(0, PREVIEW_LIMIT).map((it, i) => (
            <View key={i} style={s.row}>
              <View
                style={[s.badge, it.item_type === 'section' && s.badgeSection]}
              >
                <Text
                  style={[s.badgeText, it.item_type === 'section' && s.badgeTextSection]}
                >
                  {it.item_type === 'section' ? 'Section' : 'Task'}
                </Text>
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle} numberOfLines={1}>
                  {it.title}
                </Text>
                {it.description ? (
                  <Text style={s.rowDesc} numberOfLines={2}>
                    {it.description}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {parsed.length > PREVIEW_LIMIT && (
            <Text style={s.more}>
              …and {parsed.length - PREVIEW_LIMIT} more
            </Text>
          )}
        </>
      )}

      <View style={s.actions}>
        <View style={s.actionBtn}>
          <Button title="Cancel" onPress={close} variant="secondary" fullWidth />
        </View>
        <View style={s.actionBtn}>
          <Button
            title={parsed.length > 0 ? `Add ${parsed.length}` : 'Add'}
            onPress={submit}
            disabled={parsed.length === 0}
            fullWidth
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  textArea: {
    minHeight: 160,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  count: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent + '20',
    flexShrink: 0,
  },
  badgeSection: {
    backgroundColor: Colors.warning + '20',
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  badgeTextSection: {
    color: Colors.warning,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  rowDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  more: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    paddingVertical: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
});
