import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MediaItem } from '@/types/database';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface MediaRowProps {
  media: MediaItem[];
  uploading: boolean;
  /** Take a new photo with the camera. */
  onAddFromCamera: () => void;
  /** Pick an existing photo from the device library. */
  onAddFromLibrary: () => void;
  onRemove: (index: number) => void;
}

/** Thumbnail strip with remove buttons plus dashed camera/library add tiles —
 * shared by the task-list and SOP item editors. */
export default function MediaRow({
  media,
  uploading,
  onAddFromCamera,
  onAddFromLibrary,
  onRemove,
}: MediaRowProps) {
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
      {uploading ? (
        <View style={s.mediaAdd}>
          <ActivityIndicator size="small" color={Colors.accent} />
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={s.mediaAdd}
            onPress={onAddFromCamera}
            accessibilityLabel="Take photo"
          >
            <Ionicons name="camera" size={20} color={Colors.accent} />
            <Text style={s.mediaAddLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.mediaAdd}
            onPress={onAddFromLibrary}
            accessibilityLabel="Upload photo from library"
          >
            <Ionicons name="image-outline" size={20} color={Colors.accent} />
            <Text style={s.mediaAddLabel}>Upload</Text>
          </TouchableOpacity>
        </>
      )}
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
    gap: 2,
  },
  mediaAddLabel: {
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
});
