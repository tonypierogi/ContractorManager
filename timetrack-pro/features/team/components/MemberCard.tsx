import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadows } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import type { Profile } from '@/types/database';

interface MemberCardProps {
  member: Profile;
  onPress?: () => void;
  onRemove?: () => void;
  isCurrentUser?: boolean;
}

function getInitials(profile: Profile): string {
  const first = profile.first_name?.[0] ?? '';
  const last = profile.last_name?.[0] ?? '';
  if (first || last) return (first + last).toUpperCase();
  return profile.email[0].toUpperCase();
}

function getDisplayName(profile: Profile): string {
  if (profile.first_name || profile.last_name) {
    return [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  }
  return profile.email;
}

export default function MemberCard({ member, onPress, onRemove, isCurrentUser }: MemberCardProps) {
  const inactive = member.is_active === false;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.container, inactive && styles.containerInactive]}
    >
      {isCurrentUser && (
        <View style={styles.youBadge}>
          <Text style={styles.youBadgeText}>YOU</Text>
        </View>
      )}

      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{getInitials(member)}</Text>
        </View>
        <View style={styles.nameGroup}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {getDisplayName(member)}
            </Text>
            {inactive && (
              <View style={styles.inactivePill}>
                <Text style={styles.inactivePillText}>INACTIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.email} numberOfLines={1}>
            {member.email}
          </Text>
        </View>
        <View style={styles.metaGroup}>
          <Text style={styles.metaValue}>{formatCurrency(member.hourly_rate)}/hr</Text>
          <Text style={styles.metaLabel}>{member.role === 'admin' ? 'ADMIN' : 'CONTRACTOR'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    ...Shadows.sm,
  },
  containerInactive: {
    opacity: 0.55,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inactivePill: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  inactivePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  youBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 1,
  },
  youBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.bgPrimary,
    letterSpacing: 0.5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initials: {
    color: Colors.bgPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  nameGroup: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  email: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metaGroup: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  metaValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
