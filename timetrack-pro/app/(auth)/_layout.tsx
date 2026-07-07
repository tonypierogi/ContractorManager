import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors } from '@/constants/theme';

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  // Once a session exists (including the moment sign-in succeeds), leave the
  // auth screens — the root index routes by role and profile completeness.
  if (!isLoading && session) return <Redirect href="/" />;

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
});
