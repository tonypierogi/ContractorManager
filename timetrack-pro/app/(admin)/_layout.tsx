import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import TopNavBar, { NavItem } from '@/components/navigation/TopNavBar';
import { Colors } from '@/constants/theme';

const adminNav: NavItem[] = [
  { label: 'Team', href: '/(admin)/team', segment: 'team', icon: 'people-outline' },
  { label: 'Timesheets', href: '/(admin)/timesheets', segment: 'timesheets', icon: 'time-outline' },
  { label: 'Invoices', href: '/(admin)/invoices', segment: 'invoices', icon: 'document-text-outline' },
  { label: 'SOP', href: '/(admin)/sops', segment: 'sops', icon: 'clipboard-outline' },
  { label: 'Equipment', href: '/(admin)/equipment', segment: 'equipment', icon: 'construct-outline' },
  { label: 'Task Lists', href: '/(admin)/task-lists', segment: 'task-lists', icon: 'list-outline' },
  { label: 'Settings', href: '/(admin)/settings', segment: 'settings', icon: 'settings-outline' },
];

export default function AdminLayout() {
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
