import {
  ActivityIndicator,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useEnsureShareToken } from '@/features/task-lists/hooks';
import { shareUrlForToken } from '@/features/task-lists/api';
import { useToast } from '@/components/ui/Toast';
import { Colors, FontSize, Spacing } from '@/constants/theme';

/**
 * Top-bar "Share" action for a task list / SOP. Mints the list's share token
 * (first tap only — after that the same link is reused) and hands the public
 * web-page URL to the native share sheet, so someone without the app can open
 * the checklist in a browser and check items off with the crew in real time.
 */
export default function ShareListButton({
  taskListId,
}: {
  taskListId: string | undefined;
}) {
  const { showToast } = useToast();
  const ensureToken = useEnsureShareToken();

  const handleShare = async () => {
    if (!taskListId || ensureToken.isPending) return;
    try {
      const token = await ensureToken.mutateAsync(taskListId);
      const url = shareUrlForToken(token);
      if (Platform.OS === 'web') {
        // No native share sheet on web — copy instead.
        await Clipboard.setStringAsync(url);
        showToast('Share link copied');
      } else if (Platform.OS === 'ios') {
        await Share.share({ url });
      } else {
        // Android's sheet only reads `message`.
        await Share.share({ message: url });
      }
    } catch {
      showToast('Could not create the share link', 'error');
    }
  };

  return (
    <TouchableOpacity
      onPress={handleShare}
      disabled={!taskListId || ensureToken.isPending}
      style={s.btn}
      accessibilityRole="button"
      accessibilityLabel="Share this checklist"
    >
      {ensureToken.isPending ? (
        <ActivityIndicator size="small" color={Colors.accent} />
      ) : (
        <Ionicons name="share-outline" size={16} color={Colors.accent} />
      )}
      <Text style={s.text}>Share</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  text: {
    fontSize: FontSize.md,
    color: Colors.accent,
    fontWeight: '600',
  },
});
