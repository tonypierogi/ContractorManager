import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';

export interface NavItem {
  label: string;
  href: string;
  segment: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Items sharing a group collapse into a labeled dropdown on wide screens
   * (legacy grouped nav: 'Operations' for admin, 'Work' for employees). */
  group?: string;
}

interface TopNavBarProps {
  items: NavItem[];
}

type NavEntry =
  | { type: 'item'; item: NavItem }
  | { type: 'group'; name: string; items: NavItem[] };

const WIDE_BREAKPOINT = 768;

export default function TopNavBar({ items }: TopNavBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const triggerRefs = useRef<Record<string, View | null>>({});

  const isAdmin = profile?.role === 'admin';
  const isInAdminView = pathname.startsWith('/(admin)');

  const isActive = (item: NavItem) => pathname.includes(`/${item.segment}`);

  // Collapse grouped items into a dropdown entry at the first item's position.
  const entries = useMemo<NavEntry[]>(() => {
    const out: NavEntry[] = [];
    const groupIndex = new Map<string, number>();
    for (const item of items) {
      if (!isWide || !item.group) {
        out.push({ type: 'item', item });
        continue;
      }
      const existing = groupIndex.get(item.group);
      if (existing == null) {
        groupIndex.set(item.group, out.length);
        out.push({ type: 'group', name: item.group, items: [item] });
      } else {
        (out[existing] as Extract<NavEntry, { type: 'group' }>).items.push(item);
      }
    }
    return out;
  }, [items, isWide]);

  const openMenu = (name: string) => {
    const node = triggerRefs.current[name];
    if (!node) {
      setMenuPos(null);
      setOpenGroup(name);
      return;
    }
    node.measureInWindow((x, y, _w, h) => {
      setMenuPos({ x, y: y + h + 4 });
      setOpenGroup(name);
    });
  };

  const closeMenu = () => setOpenGroup(null);

  const navigate = (item: NavItem) => {
    closeMenu();
    setMobileMenuOpen(false);
    router.push(item.href as any);
  };

  const toggleRole = () => {
    if (isInAdminView) {
      router.push('/(employee)/home');
    } else if (isAdmin) {
      router.push('/(admin)/team');
    }
  };

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
  };

  const renderPill = (item: NavItem) => {
    const active = isActive(item);
    return (
      <TouchableOpacity
        key={item.href}
        onPress={() => navigate(item)}
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
  };

  const renderGroupTrigger = (entry: Extract<NavEntry, { type: 'group' }>) => {
    const active = entry.items.some(isActive);
    const open = openGroup === entry.name;
    return (
      <View
        key={`group-${entry.name}`}
        ref={(node) => {
          triggerRefs.current[entry.name] = node;
        }}
        collapsable={false}
      >
        <TouchableOpacity
          onPress={() => (open ? closeMenu() : openMenu(entry.name))}
          style={[styles.navButton, active && styles.navButtonActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.navLabel, active && styles.navLabelActive]}>
            {entry.name}
          </Text>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={active ? Colors.accent : Colors.textSecondary}
            style={styles.chevron}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const openEntry =
    openGroup != null
      ? (entries.find(
          (e) => e.type === 'group' && e.name === openGroup,
        ) as Extract<NavEntry, { type: 'group' }> | undefined)
      : undefined;

  const navContent = entries.map((entry) =>
    entry.type === 'item' ? renderPill(entry.item) : renderGroupTrigger(entry),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.topRow}>
        {!isWide && (
          <TouchableOpacity
            onPress={() => setMobileMenuOpen(true)}
            style={styles.hamburger}
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
          >
            <Ionicons name="menu" size={24} color={Colors.text} />
          </TouchableOpacity>
        )}

        <View style={styles.brandGroup}>
          <Ionicons name="diamond" size={20} color={Colors.accent} />
          <Text style={styles.logo}>TimeTrackPro</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          )}
        </View>

        {isWide && <View style={styles.navWide}>{navContent}</View>}

        <View style={styles.userSection}>
          {profile && isWide && (
            <Text style={styles.greeting} numberOfLines={1}>
              Hello, {profile.first_name ?? 'User'}!
            </Text>
          )}
          {isAdmin && isWide && (
            <View style={styles.roleToggleWide}>
              <TouchableOpacity
                onPress={() => {
                  if (!isInAdminView) toggleRole();
                }}
                style={[
                  styles.roleButtonWide,
                  isInAdminView && styles.roleButtonWideActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleButtonWideText,
                    isInAdminView && styles.roleButtonWideTextActive,
                  ]}
                >
                  Admin
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (isInAdminView) toggleRole();
                }}
                style={[
                  styles.roleButtonWide,
                  !isInAdminView && styles.roleButtonWideActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleButtonWideText,
                    !isInAdminView && styles.roleButtonWideTextActive,
                  ]}
                >
                  Employee
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={mobileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMobileMenuOpen(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMobileMenuOpen(false)}
        >
          <View
            style={[
              styles.mobileMenuPanel,
              { paddingTop: insets.top + Spacing.md },
            ]}
          >
            {isAdmin && (
              <View style={styles.roleToggleContainer}>
                <Text style={styles.roleLabel}>View as:</Text>
                <View style={styles.roleToggle}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isInAdminView) toggleRole();
                    }}
                    style={[
                      styles.roleButton,
                      isInAdminView && styles.roleButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        isInAdminView && styles.roleButtonTextActive,
                      ]}
                    >
                      Admin
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (isInAdminView) toggleRole();
                    }}
                    style={[
                      styles.roleButton,
                      !isInAdminView && styles.roleButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        !isInAdminView && styles.roleButtonTextActive,
                      ]}
                    >
                      Employee
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {items.map((item, idx) => {
              const active = isActive(item);
              const showGroupLabel =
                !!item.group && item.group !== items[idx - 1]?.group;
              return (
                <View key={item.href}>
                  {showGroupLabel && (
                    <Text style={styles.menuSectionLabel}>{item.group}</Text>
                  )}
                  <TouchableOpacity
                    onPress={() => navigate(item)}
                    style={[styles.menuItem, active && styles.menuItemActive]}
                    activeOpacity={0.7}
                  >
                    {item.icon && (
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={active ? Colors.accent : Colors.textSecondary}
                      />
                    )}
                    <Text
                      style={[
                        styles.menuItemLabel,
                        active && styles.navLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity
              onPress={handleSignOut}
              style={styles.signOutMenuItem}
              activeOpacity={0.7}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color={Colors.textSecondary}
              />
              <Text style={styles.signOutMenuItemLabel}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={openEntry != null}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <View
            style={[
              styles.menuPanel,
              menuPos ? { left: menuPos.x, top: menuPos.y } : styles.menuFallback,
            ]}
          >
            {openEntry?.items.map((item) => {
              const active = isActive(item);
              return (
                <TouchableOpacity
                  key={item.href}
                  onPress={() => navigate(item)}
                  style={[styles.menuItem, active && styles.menuItemActive]}
                  activeOpacity={0.7}
                >
                  {item.icon && (
                    <Ionicons
                      name={item.icon}
                      size={16}
                      color={active ? Colors.accent : Colors.textSecondary}
                    />
                  )}
                  <Text style={[styles.menuItemLabel, active && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  // Phone layout: destinations live behind the hamburger. Inline pills either
  // got squeezed to zero width or hid most items off-screen with no affordance.
  hamburger: {
    padding: Spacing.xs,
    marginLeft: -Spacing.xs,
    flexShrink: 0,
  },
  mobileMenuPanel: {
    backgroundColor: Colors.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    ...Shadows.md,
  },
  menuSectionLabel: {
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  navWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
  chevron: {
    marginLeft: 4,
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
  menuBackdrop: {
    flex: 1,
  },
  menuPanel: {
    position: 'absolute',
    minWidth: 210,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xs,
    ...Shadows.md,
  },
  menuFallback: {
    top: 64,
    left: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  menuItemActive: {
    backgroundColor: Colors.accentGlow,
  },
  menuItemLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  roleToggleContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  roleLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  roleToggle: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
    padding: 2,
  },
  roleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: Colors.accent,
  },
  roleButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleButtonTextActive: {
    color: Colors.bgPrimary,
  },
  signOutMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.md,
  },
  signOutMenuItemLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  roleToggleWide: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
    padding: 2,
  },
  roleButtonWide: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  roleButtonWideActive: {
    backgroundColor: Colors.accent,
  },
  roleButtonWideText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleButtonWideTextActive: {
    color: Colors.bgPrimary,
  },
});
