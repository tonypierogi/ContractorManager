import { useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';
import MemberCard from '@/features/team/components/MemberCard';
import { useTeamMembers, useDeleteTeamMember } from '@/features/team/hooks';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Spacing, FontSize } from '@/constants/theme';
import type { Profile } from '@/types/database';

export default function TeamScreen() {
  const { user } = useAuth();
  const { data: members, isLoading, refetch } = useTeamMembers({ includeInactive: true });
  const deleteMember = useDeleteTeamMember();
  const { width } = useWindowDimensions();
  const numColumns = width >= 900 ? 3 : width >= 600 ? 2 : 1;

  // Active members first; inactive sink to the bottom.
  const sortedMembers = useMemo(() => {
    if (!members) return [];
    return [...members].sort((a, b) => {
      const aInactive = a.is_active === false ? 1 : 0;
      const bInactive = b.is_active === false ? 1 : 0;
      return aInactive - bInactive;
    });
  }, [members]);

  const handleRemove = useCallback(
    (member: Profile) => {
      Alert.alert(
        'Remove Member',
        `Remove ${member.first_name ?? ''} ${member.last_name ?? ''} from the team?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => deleteMember.mutate(member.id),
          },
        ],
      );
    },
    [deleteMember],
  );

  const renderItem = useCallback(
    ({ item }: { item: Profile }) => (
      <MemberCard
        member={item}
        onPress={() => router.push(`/(admin)/team/${item.id}`)}
        onRemove={() => handleRemove(item)}
        isCurrentUser={item.id === user?.id}
      />
    ),
    [user?.id, handleRemove],
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Team Members</Text>
        <Button
          title="Add Team Member"
          onPress={() => router.push('/(auth)/signup' as any)}
          size="sm"
          icon={<Ionicons name="person-add-outline" size={16} color={Colors.bgPrimary} />}
        />
      </View>
      <FlatList
        key={numColumns}
        data={sortedMembers}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.list}
        refreshing={isLoading}
        onRefresh={refetch}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No team members yet</Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  list: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  row: {
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  separator: {
    height: Spacing.sm,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
});
