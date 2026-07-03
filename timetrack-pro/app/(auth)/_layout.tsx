import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';

export default function AuthLayout() {
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
