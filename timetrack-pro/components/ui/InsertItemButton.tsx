import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface InsertItemButtonProps {
  /** Add a task at this spot in the list. */
  onPress: () => void;
  label?: string;
}

/**
 * The hairline between two rows of an editor list, with an add control sitting
 * on it. Writing a checklist is rarely front-to-back — a step you forgot goes
 * in where it belongs instead of at the top, then dragged down the list.
 */
export default function InsertItemButton({
  onPress,
  label = 'Add task here',
}: InsertItemButtonProps) {
  return (
    <View style={s.wrap}>
      <View style={s.line} />
      <TouchableOpacity
        style={s.btn}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={13} color={Colors.accent} />
        <Text style={s.btnText}>Add task</Text>
      </TouchableOpacity>
      <View style={s.line} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  btnText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
});
