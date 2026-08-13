import {
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MediaItem } from '@/types/database';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

interface MediaRowProps {
  media: MediaItem[];
  uploading: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/** Thumbnail strip with remove buttons plus a dashed add tile — shared by the
 * task-list and SOP item editors. */
export default function MediaRow({ media, uploading, onAdd, onRemove }: MediaRowProps) {
  return (
    <View style={s.mediaRow}>
      {media.map((m, mi) => (
        <View key={`${m.url}-${mi}`} style={s.mediaThumbWrap}>
          {m.type?.startsWith('video') ? (
            <View style={[s.mediaThumb, s.mediaVideo]}>
              <Ionicons name="videocam" size={20} color={Colors.textSecondary} />
            </View>
          ) : (
            <Image source={{ uri: m.url }} style={s.mediaThumb} />
          )}
          <TouchableOpacity style={s.mediaRemove} onPress={() => onRemove(mi)} hitSlop={6}>
            <Ionicons name="close" size={12} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={s.mediaAdd}
        onPress={onAdd}
        disabled={uploading}
        accessibilityLabel="Add image"
      >
        {uploading ? (
          <ActivityIndicator size="small" color={Colors.accent} />
        ) : (
          <Ionicons name="add" size={22} color={Colors.accent} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  mediaThumbWrap: {
    position: 'relative',
  },
  mediaThumb: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  mediaVideo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaAdd: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
