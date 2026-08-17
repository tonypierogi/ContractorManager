import { Redirect, Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import TopNavBar, { NavItem } from '@/components/navigation/TopNavBar';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors } from '@/constants/theme';

// The two hubs still preview the day's work (Home) and the person
// (My Page), but the destinations they link into are also reachable
// directly from the hamburger so contractors don't have to route through
// a hub to get to Time Clock, My Work, Venue, Inventory, or Schedule.
const employeeNav: NavItem[] = [
  { label: 'Home', href: '/(employee)/home', segment: 'home', icon: 'home-outline' },
  { label: 'My Page', href: '/(employee)/me', segment: 'me', icon: 'person-circle-outline' },
  { label: 'Time Clock', href: '/(employee)/timeclock', segment: 'timeclock', icon: 'time-outline' },
  { label: 'My Work', href: '/(employee)/work', segment: 'work', icon: 'briefcase-outline' },
  { label: 'Venue & Equipment', href: '/(employee)/venue', segment: 'venue', icon: 'map-outline' },
  { label: 'Inventory', href: '/(employee)/inventory', segment: 'inventory', icon: 'cube-outline' },
  { label: 'Schedule', href: '/(employee)/schedule', segment: 'schedule', icon: 'calendar-outline' },
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
