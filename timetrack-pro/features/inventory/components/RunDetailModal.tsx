import React from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import Modal from '@/components/ui/Modal';
import { getLocationLabel } from '@/features/locations/zones';
import { formatDate, formatTime } from '@/utils/format';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useRunChecks } from '../hooks';
import InventoryStatusBadge from './InventoryStatusBadge';
import type { InventoryRunSummary } from '../api';

interface RunDetailModalProps {
  run: InventoryRunSummary | null;
  onClose: () => void;
}

export default function RunDetailModal({ run, onClose }: RunDetailModalProps) {
  const { data: checks, isLoading } = useRunChecks(run?.id ?? null);

  return (
    <Modal
      visible={!!run}
      onClose={onClose}
      title={run ? `${formatDate(run.started_at)} · ${run.runnerName}` : ''}
      size="md"
    >
      {run ? (
        <Text style={s.subtitle}>
          Started {formatTime(run.started_at)}
          {run.completed_at ? ` · finished ${formatTime(run.completed_at)}` : ''}
        </Text>
      ) : null}

      {isLoading ? (
        <View style={s.loading}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : !checks?.length ? (
        <Text style={s.empty}>No items were checked in this run.</Text>
      ) : (
        checks.map((check) => (
          <View key={check.id} style={s.checkCard}>
            <View style={s.checkHeader}>
              {check.inventory_items?.image_url ? (
                <Image
                  source={{ uri: check.inventory_items.image_url }}
                  style={s.thumb}
                  resizeMode="cover"
                />
              ) : null}
              <View style={s.checkInfo}>
                <Text style={s.checkName} numberOfLines={1}>
                  {check.inventory_items?.name || 'Unknown item'}
                </Text>
                {check.inventory_items?.location ? (
                  <Text style={s.checkLocation} numberOfLines={1}>
                    {getLocationLabel(check.inventory_items.location)}
                  </Text>
                ) : null}
              </View>
              <InventoryStatusBadge status={check.status} />
            </View>
            {check.notes ? <Text style={s.notes}>{check.notes}</Text> : null}
            {check.photo_url ? (
              <Image
                source={{ uri: check.photo_url }}
                style={s.photo}
                resizeMode="cover"
              />
            ) : null}
          </View>
        ))
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  loading: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    padding: Spacing.lg,
  },
  checkCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  checkInfo: {
    flex: 1,
  },
  checkName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  checkLocation: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  notes: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgElevated,
  },
});
