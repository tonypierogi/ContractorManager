import { Redirect, Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import TopNavBar, { NavItem } from '@/components/navigation/TopNavBar';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors } from '@/constants/theme';

const employeeNav: NavItem[] = [
  { label: 'Time Clock', href: '/(employee)/timeclock', segment: 'timeclock', icon: 'timer-outline' },
  { label: 'Shifts', href: '/(employee)/shifts', segment: 'shifts', icon: 'calendar-outline' },
  { label: 'My Schedule', href: '/(employee)/schedule', segment: 'schedule', icon: 'calendar-clear-outline' },
  { label: 'SOPs', href: '/(employee)/sops', segment: 'sops', icon: 'clipboard-outline', group: 'Work' },
  { label: 'Tasks', href: '/(employee)/tasks', segment: 'tasks', icon: 'list-outline', group: 'Work' },
  { label: 'Locations', href: '/(employee)/locations', segment: 'locations', icon: 'map-outline', group: 'Work' },
  { label: 'Inventory', href: '/(employee)/inventory', segment: 'inventory', icon: 'cube-outline', group: 'Work' },
  { label: 'Invoices', href: '/(employee)/invoices', segment: 'invoices', icon: 'document-text-outline' },
  { label: 'Profile', href: '/(employee)/profile', segment: 'profile', icon: 'person-outline' },
];

export default function EmployeeLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <View style={styles.container}>
      <TopNavBar items={employeeNav} />
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
