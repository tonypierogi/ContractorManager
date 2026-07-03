import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export interface NavItem {
  label: string;
  href: string;
  segment: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface TopNavBarProps {
  items: NavItem[];
}

export default function TopNavBar({ items }: TopNavBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();

  const isActive = (item: NavItem) => pathname.includes(`/${item.segment}`);
  const isAdmin = profile?.role === 'admin';

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.brandGroup}>
        <Ionicons name="diamond" size={20} color={Colors.accent} />
        <Text style={styles.logo}>TimeTrackPro</Text>
        {isAdmin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nav}
        style={styles.navScroll}
      >
        {items.map((item) => {
          const active = isActive(item);
          return (
            <TouchableOpacity
              key={item.href}
              onPress={() => router.push(item.href as any)}
              style={[styles.navButton, active && styles.navButtonActive]}
              activeOpacity={0.7}
            >
              {item.icon && (
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={active ? Colors.accent : Colors.textSecondary}
                  style={styles.navIcon}
                />
              )}
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.userSection}>
        {profile && (
          <Text style={styles.greeting} numberOfLines={1}>
            Hello, {profile.first_name ?? 'User'}!
          </Text>
        )}
        <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.lg,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  logo: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  adminBadge: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.bgPrimary,
    letterSpacing: 0.5,
  },
  navScroll: {
    flex: 1,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  navButtonActive: {
    backgroundColor: Colors.accentGlow,
  },
  navIcon: {
    marginRight: 6,
  },
  navLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  navLabelActive: {
    color: Colors.accent,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    maxWidth: 120,
  },
  signOutButton: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
});
