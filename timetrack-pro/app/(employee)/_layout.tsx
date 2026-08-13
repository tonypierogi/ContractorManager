import { Redirect, Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import TopNavBar, { NavItem } from '@/components/navigation/TopNavBar';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors } from '@/constants/theme';

// Two-hub nav: everything about the day's work (Time Clock, My Work,
// Locations, Inventory) previews on Home; everything about the person
// (Profile, Invoices, Shifts, Schedule) previews on My Page. The full pages
// stay routable — the hubs link into them.
const employeeNav: NavItem[] = [
  { label: 'Home', href: '/(employee)/home', segment: 'home', icon: 'home-outline' },
  { label: 'My Page', href: '/(employee)/me', segment: 'me', icon: 'person-circle-outline' },
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
