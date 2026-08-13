import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { isProfileIncomplete } from '@/features/profile/utils';
import { Colors } from '@/constants/theme';

export default function IndexRedirect() {
  const { session, profile, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile || isProfileIncomplete(profile)) {
    return <Redirect href="/(employee)/profile" />;
  }

  if (role === 'admin') {
    return <Redirect href="/(admin)/team" />;
  }

  return <Redirect href="/(employee)/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgPrimary,
  },
});
