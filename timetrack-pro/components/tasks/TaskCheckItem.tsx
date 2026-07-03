import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import type { TaskListItem } from '@/types/database';

interface TaskCheckItemProps {
  item: TaskListItem & { checked: boolean };
  onToggle: () => void;
}

export default function TaskCheckItem({ item, onToggle }: TaskCheckItemProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={styles.row}
    >
      <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
        {item.checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, item.checked && styles.titleChecked]}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : null}
        {item.media && item.media.length > 0 && (
          <View style={styles.mediaRow}>
            {item.media.slice(0, 4).map((m, i) => (
              <Image
                key={i}
                source={{ uri: m.url }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ))}
            {item.media.length > 4 && (
              <View style={styles.moreMedia}>
                <Text style={styles.moreText}>+{item.media.length - 4}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm + 4,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: FontWeight.bold,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  titleChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  description: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  moreMedia: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
});
