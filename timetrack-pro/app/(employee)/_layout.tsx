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
  { label: 'Venue', href: '/(employee)/venue', segment: 'venue', icon: 'business-outline', group: 'Venue' },
  { label: 'Inventory', href: '/(employee)/inventory', segment: 'inventory', icon: 'cube-outline', group: 'Venue' },
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
