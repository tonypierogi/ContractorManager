import { Redirect, Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import TopNavBar, { NavItem } from '@/components/navigation/TopNavBar';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors } from '@/constants/theme';

const employeeNav: NavItem[] = [
  { label: 'Time Clock', href: '/(employee)/timeclock', segment: 'timeclock', icon: 'timer-outline' },
  // Assigned task lists and today's SOP live on one page — contractors don't
  // distinguish between them, and two destinations meant two places to check.
  { label: 'My Work', href: '/(employee)/work', segment: 'work', icon: 'clipboard-outline' },
  { label: 'Shifts', href: '/(employee)/shifts', segment: 'shifts', icon: 'calendar-outline' },
  { label: 'My Schedule', href: '/(employee)/schedule', segment: 'schedule', icon: 'calendar-clear-outline' },
  { label: 'Locations', href: '/(employee)/locations', segment: 'locations', icon: 'map-outline', group: 'Site' },
  { label: 'Inventory', href: '/(employee)/inventory', segment: 'inventory', icon: 'cube-outline', group: 'Site' },
  { label: 'Invoices', href: '/(employee)/invoices', segment: 'invoices', icon: 'document-text-outline' },
  { label: 'Profile', href: '/(employee)/profile', segment: 'profile', icon: 'person-outline' },
];

export default function EmployeeLayout() {
  const { session, role, isLoading } = useAuth();

  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <View style={styles.container}>
      <TopNavBar
        items={employeeNav}
        viewSwitch={
          role === 'admin'
            ? { label: 'Admin View', href: '/(admin)/team' }
            : undefined
        }
      />
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
