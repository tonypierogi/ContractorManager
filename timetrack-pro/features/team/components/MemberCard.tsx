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
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatCurrency(member.hourly_rate)}</Text>
          <Text style={styles.statLabel}>HOURLY RATE</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, member.role === 'admin' ? styles.accentText : styles.accentText]}>
            {member.role === 'admin' ? 'Admin' : 'Contractor'}
          </Text>
          <Text style={styles.statLabel}>ROLE</Text>
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
    padding: Spacing.lg,
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
    top: Spacing.md,
    right: Spacing.md,
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
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initials: {
    color: Colors.bgPrimary,
    fontSize: FontSize.lg,
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
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
  },
  statValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  accentText: {
    color: Colors.accent,
  },
});
