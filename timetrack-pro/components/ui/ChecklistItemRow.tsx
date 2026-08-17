import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Lightbox from '@/components/ui/Lightbox';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export interface ChecklistRowEquipment {
  /** Already-resolved display name (not an id). */
  name: string;
  /** Pre-formatted movement label, e.g. "Back Closet → Lobby". */
  placement?: string | null;
}

interface ChecklistItemRowProps {
  title: string;
  description?: string | null;
  /** Image URLs; the first one is the leading thumbnail. */
  images?: string[];
  /** Pre-formatted zone label, e.g. "Big Room → Loft". */
  locationLabel?: string | null;
  equipment?: ChecklistRowEquipment[];
  /** When set, the expanded equipment block is tappable — e.g. to open the
   * zone/floor-plan detail modal. */
  onPressEquipment?: () => void;
  checked: boolean;
  checkedByName?: string | null;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * One checkable task row, shared by the task-list and SOP checklists (and
 * mirrored by the public share page): photo thumbnail on the left (tap to view
 * full screen), title with a collapsible details dropdown under it (notes,
 * location, equipment, extra photos), and the complete checkbox on the right.
 */
function ChecklistItemRow({
  title,
  description,
  images = [],
  locationLabel,
  equipment = [],
  onPressEquipment,
  checked,
  checkedByName,
  disabled = false,
  onToggle,
}: ChecklistItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);

  const hasDetails =
    !!description ||
    !!locationLabel ||
    equipment.length > 0 ||
    images.length > 1;

  // Collapsed one-line summary so a closed row still says what's inside.
  const summary = useMemo(() => {
    const parts: string[] = [];
    if (locationLabel) parts.push(locationLabel);
    if (images.length > 1) parts.push(`${images.length} photos`);
    if (equipment.length > 0) parts.push(`${equipment.length} equipment`);
    return parts.join(' · ');
  }, [locationLabel, images.length, equipment.length]);

  return (
    <View style={[s.card, checked && s.cardChecked]}>
      <View style={s.mainRow}>
        {images.length > 0 ? (
          <TouchableOpacity
            onPress={() => setLightboxAt(0)}
            activeOpacity={0.8}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo for ${title}`}
          >
            <Image source={{ uri: images[0] }} style={s.thumb} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={[s.thumb, s.thumbEmpty]}>
            <Ionicons name="image-outline" size={20} color={Colors.textMuted} />
          </View>
        )}

        <TouchableOpacity
          style={s.body}
          onPress={() => setExpanded((v) => !v)}
          disabled={!hasDetails}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={title}
        >
          <Text style={[s.title, checked && s.titleChecked]}>{title}</Text>
          {hasDetails ? (
            <View style={s.hintRow}>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={Colors.textMuted}
              />
              <Text style={s.hintText} numberOfLines={1}>
                {expanded ? 'Hide details' : summary || 'Details'}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onToggle}
          disabled={disabled}
          hitSlop={10}
          style={s.checkTarget}
          accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled }}
          accessibilityLabel={`Mark ${title} ${checked ? 'incomplete' : 'complete'}`}
        >
          <Ionicons
            name={checked ? 'checkbox' : 'square-outline'}
            size={26}
            color={checked ? Colors.accent : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {expanded && hasDetails && (
        <View style={s.details}>
          {description ? <Text style={s.detailDesc}>{description}</Text> : null}
          {locationLabel ? (
            <View style={s.zoneRow}>
              <Ionicons
                name="location-outline"
                size={13}
                color={Colors.textSecondary}
              />
              <Text style={s.zoneText}>{locationLabel}</Text>
            </View>
          ) : null}
          {equipment.length > 0 && (
            <TouchableOpacity
              style={s.equipmentBlock}
              onPress={onPressEquipment}
              disabled={!onPressEquipment}
              activeOpacity={0.7}
              accessibilityRole={onPressEquipment ? 'button' : undefined}
              accessibilityLabel={
                onPressEquipment ? `Equipment details for ${title}` : undefined
              }
            >
              {equipment.map((eq, i) => (
                <View key={`${eq.name}-${i}`} style={s.equipmentRow}>
                  <Ionicons
                    name="cube-outline"
                    size={13}
                    color={Colors.textSecondary}
                  />
                  <Text style={s.equipmentText} numberOfLines={2}>
                    <Text style={s.equipmentName}>{eq.name}</Text>
                    {eq.placement ? `  ${eq.placement}` : ''}
                  </Text>
                </View>
              ))}
              {onPressEquipment ? (
                <View style={s.equipmentHint}>
                  <Ionicons
                    name="map-outline"
                    size={13}
                    color={Colors.accent}
                  />
                  <Text style={s.equipmentHintText}>Zones & floor plans</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
          {images.length > 1 && (
            <View style={s.mediaRow}>
              {images.slice(1).map((url, i) => (
                <TouchableOpacity
                  key={url + i}
                  onPress={() => setLightboxAt(i + 1)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: url }}
                    style={s.extraThumb}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {checked && checkedByName ? (
            <Text style={s.checkedBy}>Checked by {checkedByName}</Text>
          ) : null}
        </View>
      )}

      <Lightbox
        images={images}
        startIndex={lightboxAt ?? 0}
        visible={lightboxAt != null}
        onClose={() => setLightboxAt(null)}
      />
    </View>
  );
}

// Memoized: checklists re-render on every optimistic toggle, but only the
// toggled row's props change.
export default React.memo(ChecklistItemRow);

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  cardChecked: {
    opacity: 0.6,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  titleChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  hintText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  checkTarget: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  zoneText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  equipmentBlock: {
    marginTop: Spacing.sm,
    gap: 4,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  equipmentText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  equipmentName: {
    fontWeight: '600',
    color: Colors.text,
  },
  equipmentHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  equipmentHintText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '500',
  },
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  extraThumb: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  checkedBy: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
});
