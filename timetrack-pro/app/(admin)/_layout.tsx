import { Redirect, Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import TopNavBar, { NavItem } from '@/components/navigation/TopNavBar';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors } from '@/constants/theme';

const adminNav: NavItem[] = [
  { label: 'Home', href: '/(admin)/home', segment: 'home', icon: 'home-outline' },
  { label: 'Team', href: '/(admin)/team', segment: 'team', icon: 'people-outline' },
  { label: 'Timesheets', href: '/(admin)/timesheets', segment: 'timesheets', icon: 'time-outline' },
  { label: 'Schedule', href: '/(admin)/schedule', segment: 'schedule', icon: 'calendar-outline' },
  // Operations: the day-to-day tools. Work bundles SOPs + task lists.
  { label: 'Work', href: '/(admin)/work', segment: 'work', icon: 'briefcase-outline', group: 'Operations' },
  { label: 'Locations & Equipment', href: '/(admin)/locations', segment: 'locations', icon: 'map-outline', group: 'Operations' },
  { label: 'Inventory', href: '/(admin)/inventory', segment: 'inventory', icon: 'cube-outline', group: 'Operations' },
  // Manage: business/admin chores, separate from operations.
  { label: 'Invoices', href: '/(admin)/invoices', segment: 'invoices', icon: 'document-text-outline', group: 'Manage' },
  { label: 'Settings', href: '/(admin)/settings', segment: 'settings', icon: 'settings-outline', group: 'Manage' },
];

export default function AdminLayout() {
  const { session, role, isLoading } = useAuth();

  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (role !== 'admin') return <Redirect href="/" />;

  return (
    <View style={styles.container}>
      <TopNavBar items={adminNav} />
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    flex: 1,
  },
});
