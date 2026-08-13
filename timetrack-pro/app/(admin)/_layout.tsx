import { Redirect, Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import TopNavBar, { NavItem } from '@/components/navigation/TopNavBar';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors } from '@/constants/theme';

const adminNav: NavItem[] = [
  { label: 'Team', href: '/(admin)/team', segment: 'team', icon: 'people-outline' },
  { label: 'Timesheets', href: '/(admin)/timesheets', segment: 'timesheets', icon: 'time-outline' },
  { label: 'Schedule', href: '/(admin)/schedule', segment: 'schedule', icon: 'calendar-outline' },
  { label: 'SOP', href: '/(admin)/sops', segment: 'sops', icon: 'clipboard-outline', group: 'Operations' },
  { label: 'Equipment', href: '/(admin)/equipment', segment: 'equipment', icon: 'construct-outline', group: 'Operations' },
  { label: 'Task Lists', href: '/(admin)/task-lists', segment: 'task-lists', icon: 'list-outline', group: 'Operations' },
  { label: 'Venue', href: '/(admin)/venue', segment: 'venue', icon: 'business-outline', group: 'Operations' },
  { label: 'Inventory', href: '/(admin)/inventory', segment: 'inventory', icon: 'cube-outline', group: 'Operations' },
  { label: 'Invoices', href: '/(admin)/invoices', segment: 'invoices', icon: 'document-text-outline' },
  { label: 'Settings', href: '/(admin)/settings', segment: 'settings', icon: 'settings-outline' },
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
