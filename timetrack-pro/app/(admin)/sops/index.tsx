import { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Button from '@/components/ui/Button';
import {
  useSopTemplates,
  useDeleteSopTemplate,
  useCompletedDailySops,
} from '@/hooks/useSops';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { formatDate } from '@/utils/format';
import type { SopTemplate } from '@/types/database';

export default function SopsScreen() {
  const { data: templates, isLoading } = useSopTemplates();
  const { data: completedSops } = useCompletedDailySops();
  const deleteSop = useDeleteSopTemplate();

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete SOP', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteSop.mutate(id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.heading}>Standard Operating Procedures</Text>
          <Button
            title="+ Create SOP"
            onPress={() => router.push('/(admin)/sops/editor')}
            size="sm"
          />
        </View>

        {/* SOP Templates Panel */}
        <View style={styles.panel}>
          {templates && templates.length > 0 ? (
            templates.map((item: SopTemplate, index: number) => (
              <View
                key={item.id}
                style={[
                  styles.templateRow,
                  index < templates.length - 1 && styles.templateRowBorder,
                ]}
              >
                <Text style={styles.templateName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.templateActions}>
                  <Button
                    title="Edit"
                    onPress={() =>
                      router.push(`/(admin)/sops/editor?id=${item.id}`)
                    }
                    variant="secondary"
                    size="sm"
                  />
                  <Button
                    title="Delete"
                    onPress={() => handleDelete(item.id, item.name)}
                    variant="danger"
                    size="sm"
                  />
                </View>
              </View>
            ))
          ) : !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No SOPs yet. Create your first one.</Text>
            </View>
          ) : null}
        </View>

        {/* Completed Checklists Panel */}
        <View style={styles.panel}>
          <View style={styles.sectionHeader}>
            <View style={styles.accentDot} />
            <Text style={styles.sectionTitle}>Completed Checklists</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Daily checklists that have been fully completed.
          </Text>

          {completedSops && completedSops.length > 0 ? (
            completedSops.map((sop: any) => {
              const sopName = sop.sop_templates?.name ?? 'Checklist';
              const completedDate = sop.completed_at
                ? new Date(sop.completed_at).toLocaleString()
                : '';
              return (
                <View key={sop.id} style={styles.completedRow}>
                  <View style={styles.completedInfo}>
                    <Text style={styles.completedName}>{sopName}</Text>
                    <Text style={styles.completedMeta}>
                      {formatDate(sop.date)}
                      {completedDate ? `  Completed ${completedDate}` : ''}
                    </Text>
                  </View>
                  <Button
                    title="Review"
                    variant="secondary"
                    size="sm"
                    onPress={() => {}}
                  />
                </View>
              );
            })
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No completed checklists yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.md,
  },
  panel: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  templateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
  },
  templateRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  templateName: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.md,
  },
  templateActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  completedInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  completedName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  completedMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
