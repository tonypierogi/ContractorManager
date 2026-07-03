import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import TopNavBar, { NavItem } from '@/components/navigation/TopNavBar';
import { Colors } from '@/constants/theme';

const employeeNav: NavItem[] = [
  { label: 'Time Clock', href: '/(employee)/timeclock', segment: 'timeclock', icon: 'timer-outline' },
  { label: 'Shifts', href: '/(employee)/shifts', segment: 'shifts', icon: 'calendar-outline' },
  { label: 'Invoices', href: '/(employee)/invoices', segment: 'invoices', icon: 'document-text-outline' },
  { label: 'SOPs', href: '/(employee)/sops', segment: 'sops', icon: 'clipboard-outline' },
  { label: 'Tasks', href: '/(employee)/tasks', segment: 'tasks', icon: 'list-outline' },
  { label: 'Profile', href: '/(employee)/profile', segment: 'profile', icon: 'person-outline' },
];

export default function EmployeeLayout() {
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
