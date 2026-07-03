import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Modal as RNModal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth-provider';
import {
  useTaskList,
  useTaskListAssignments,
  useSaveAssignments,
} from '@/hooks/useTaskLists';
import { useTeamMembers } from '@/hooks/useTeam';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function TaskListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskListId = id ?? '';
  const { user } = useAuth();
  const { data, isLoading } = useTaskList(taskListId);
  const { data: assignments } = useTaskListAssignments(taskListId);
  const { data: members } = useTeamMembers();
  const saveAssignments = useSaveAssignments();

  const [showAssign, setShowAssign] = useState(false);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);

  const handleAssign = async (userId: string) => {
    try {
      await saveAssignments.mutateAsync({
        taskListId,
        assignedTo: [userId],
        assignedBy: user?.id ?? '',
      });
      setShowAssign(false);
    } catch {
      Alert.alert('Error', 'Failed to assign task list');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const taskList = data?.taskList;
  const items = data?.items ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button title="← Back" onPress={() => router.back()} variant="ghost" size="sm" />

        <Text style={styles.heading}>{taskList?.title}</Text>
        {taskList?.description ? (
          <Text style={styles.description}>{taskList.description}</Text>
        ) : null}

        <Text style={styles.subheading}>Items</Text>
        {items.length ? (
          items.map((item, idx) => (
            <Card key={item.id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={styles.itemNum}>
                  <Text style={styles.itemNumText}>{idx + 1}</Text>
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.itemDesc}>{item.description}</Text>
                  ) : null}
                  {item.media && item.media.length > 0 && (
                    <View style={styles.mediaRow}>
                      {item.media.map((m: { url: string; type?: string }, i: number) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setFullImageUri(m.url)}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: m.url }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </Card>
          ))
        ) : (
          <Text style={styles.emptyText}>No items in this task list</Text>
        )}

        <View style={styles.assignSection}>
          <View style={styles.assignHeader}>
            <Text style={styles.subheading}>Assignments</Text>
            <Button title="Assign" onPress={() => setShowAssign(true)} size="sm" />
          </View>

          {assignments?.length ? (
            assignments.map((a: any) => {
              const profile = a.profiles;
              const name = profile
                ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
                : 'Unknown';
              return (
                <Card key={a.id} style={styles.assignCard}>
                  <Text style={styles.assignName}>{name}</Text>
                  <View style={[styles.statusBadge, a.status === 'completed' && styles.statusComplete]}>
                    <Text style={[styles.statusText, a.status === 'completed' && styles.statusTextComplete]}>
                      {a.status}
                    </Text>
                  </View>
                </Card>
              );
            })
          ) : (
            <Text style={styles.emptyText}>Not assigned to anyone yet</Text>
          )}
        </View>

        <Modal visible={showAssign} onClose={() => setShowAssign(false)} title="Assign Task List">
          {members?.map((member) => (
            <Card key={member.id} style={styles.memberPick} onPress={() => handleAssign(member.id)}>
              <Text style={styles.memberPickName}>{member.first_name} {member.last_name}</Text>
              <Text style={styles.memberPickEmail}>{member.email}</Text>
            </Card>
          ))}
        </Modal>

        <RNModal
          visible={!!fullImageUri}
          transparent
          animationType="fade"
          onRequestClose={() => setFullImageUri(null)}
        >
          <TouchableOpacity
            style={styles.fullImageOverlay}
            activeOpacity={1}
            onPress={() => setFullImageUri(null)}
          >
            {fullImageUri ? (
              <Image
                source={{ uri: fullImageUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            ) : null}
          </TouchableOpacity>
        </RNModal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgPrimary },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgPrimary },
  content: { padding: Spacing.md },
  heading: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginVertical: Spacing.md },
  description: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.md },
  subheading: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  itemCard: { marginBottom: Spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemNum: { width: 28, height: 28, borderRadius: BorderRadius.full, backgroundColor: Colors.accent + '15', justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm },
  itemNumText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.accent },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: FontSize.md, fontWeight: '500', color: Colors.text },
  itemDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: screenWidth,
    height: screenHeight,
  },
  assignSection: { marginTop: Spacing.lg },
  assignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  assignName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.text },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full, backgroundColor: Colors.bgElevated },
  statusComplete: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500', textTransform: 'capitalize' },
  statusTextComplete: { color: Colors.success },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
  memberPick: { marginBottom: Spacing.sm },
  memberPickName: { fontSize: FontSize.md, fontWeight: '500', color: Colors.text },
  memberPickEmail: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
});
