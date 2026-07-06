import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import { getLocationLabel } from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import type { InventoryItem, InventoryStatus } from '../api';

const STATUSES: InventoryStatus[] = ['Plenty', 'Some', 'OUT'];

const STATUS_COLORS: Record<InventoryStatus, string> = {
  Plenty: Colors.success,
  Some: Colors.warning,
  OUT: Colors.danger,
};

const STATUS_FILLS: Record<InventoryStatus, string> = {
  Plenty: 'rgba(16, 185, 129, 0.15)',
  Some: 'rgba(245, 158, 11, 0.15)',
  OUT: 'rgba(244, 63, 94, 0.15)',
};

// Card tint by chosen status (legacy check-plenty/check-some/check-out).
const STATUS_TINTS: Record<InventoryStatus, string> = {
  Plenty: 'rgba(16, 185, 129, 0.06)',
  Some: 'rgba(245, 158, 11, 0.06)',
  OUT: 'rgba(244, 63, 94, 0.06)',
};

interface InventoryCheckCardProps {
  item: InventoryItem;
  status?: InventoryStatus;
  notes: string;
  photoUrl?: string | null;
  uploading: boolean;
  onSetStatus: (status: InventoryStatus) => void;
  onChangeNotes: (text: string) => void;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  onOpenImage: (url: string) => void;
}

export default function InventoryCheckCard({
  item,
  status,
  notes,
  photoUrl,
  uploading,
  onSetStatus,
  onChangeNotes,
  onPickPhoto,
  onRemovePhoto,
  onOpenImage,
}: InventoryCheckCardProps) {
  return (
    <View
      style={[
        s.card,
        status && {
          backgroundColor: STATUS_TINTS[status],
          borderColor: STATUS_COLORS[status],
        },
      ]}
    >
      <View style={s.header}>
        {item.image_url ? (
          <TouchableOpacity
            onPress={() => onOpenImage(item.image_url!)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: item.image_url }} style={s.thumb} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={s.thumbPlaceholder}>
            <Ionicons name="cube-outline" size={22} color={Colors.textMuted} />
          </View>
        )}
        <View style={s.headerInfo}>
          <Text style={s.name}>{item.name}</Text>
          {item.location ? (
            <Text style={s.location}>{getLocationLabel(item.location)}</Text>
          ) : null}
          {item.description ? (
            <Text style={s.description}>{item.description}</Text>
          ) : null}
        </View>
      </View>

      <View style={s.statusRow}>
        {STATUSES.map((st) => {
          const active = status === st;
          return (
            <TouchableOpacity
              key={st}
              style={[
                s.statusBtn,
                active && {
                  backgroundColor: STATUS_FILLS[st],
                  borderColor: STATUS_COLORS[st],
                },
              ]}
              onPress={() => onSetStatus(st)}
              activeOpacity={0.7}
            >
              <Text style={[s.statusBtnText, active && { color: STATUS_COLORS[st] }]}>
                {st}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TextInput
        style={s.notesInput}
        value={notes}
        onChangeText={onChangeNotes}
        placeholder="Notes (optional)"
        placeholderTextColor={Colors.textMuted}
      />

      <View style={s.photoRow}>
        <TouchableOpacity
          style={s.photoBtn}
          onPress={onPickPhoto}
          disabled={uploading}
          activeOpacity={0.7}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Ionicons name="camera-outline" size={16} color={Colors.text} />
          )}
          <Text style={s.photoBtnText}>
            Photo <Text style={s.requiredMark}>*</Text>
          </Text>
        </TouchableOpacity>

        {photoUrl ? (
          <View style={s.photoPreviewRow}>
            <TouchableOpacity onPress={() => onOpenImage(photoUrl)} activeOpacity={0.8}>
              <Image
                source={{ uri: photoUrl }}
                style={s.photoPreview}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <Button
              title="Remove"
              variant="secondary"
              size="sm"
              onPress={onRemovePhoto}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  location: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  description: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  statusBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  statusBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.sm,
    color: Colors.text,
    backgroundColor: Colors.bgSecondary,
    marginTop: Spacing.sm,
    minHeight: 44,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  photoBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  requiredMark: {
    color: Colors.danger,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  photoPreview: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
