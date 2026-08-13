import { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface VideoImportCardProps {
  /** Public URL of the attached source video, once uploaded. */
  videoUrl: string | null;
  fileName: string | null;
  transcript: string | null;
  busy: boolean;
  /** Current step ("Uploading video…"), shown while busy. */
  status: string | null;
  onPick: () => void;
  onClear: () => void;
}

/** Attach a walkthrough video and turn it into draft tasks. Say "capture" or
 * "screenshot" while recording to mark a moment — each one becomes a task's
 * video timestamp. */
export default function VideoImportCard({
  videoUrl,
  fileName,
  transcript,
  busy,
  status,
  onPick,
  onClear,
}: VideoImportCardProps) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  if (busy) {
    return (
      <Card style={s.card}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={s.status}>{status ?? 'Working…'}</Text>
        <Text style={s.hint}>
          This can take a minute for a longer clip — keep this screen open.
        </Text>
      </Card>
    );
  }

  if (!videoUrl) {
    return (
      <Card style={s.card}>
        <Ionicons name="videocam-outline" size={28} color={Colors.textMuted} />
        <Text style={s.hint}>
          Upload a walkthrough video and we&apos;ll transcribe it into tasks. Say
          &ldquo;capture&rdquo; while recording to timestamp a step. Max 25MB.
        </Text>
        <Button title="Pick Video" onPress={onPick} variant="secondary" />
      </Card>
    );
  }

  return (
    <Card style={s.attachedCard}>
      <View style={s.fileRow}>
        <Ionicons name="videocam" size={18} color={Colors.accent} />
        <Text style={s.fileName} numberOfLines={1}>
          {fileName || 'Attached video'}
        </Text>
        <TouchableOpacity onPress={onClear} hitSlop={8} accessibilityLabel="Remove video">
          <Ionicons name="close" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {!!transcript && (
        <>
          <TouchableOpacity
            style={s.transcriptToggle}
            onPress={() => setTranscriptOpen((open) => !open)}
            accessibilityLabel={transcriptOpen ? 'Hide transcript' : 'Show transcript'}
          >
            <Text style={s.transcriptToggleText}>
              {transcriptOpen ? 'Hide transcript' : 'Show transcript'}
            </Text>
            <Ionicons
              name={transcriptOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={Colors.accent}
            />
          </TouchableOpacity>
          {transcriptOpen && <Text style={s.transcript}>{transcript}</Text>}
        </>
      )}

      <Button title="Replace Video" onPress={onPick} variant="secondary" size="sm" />
    </Card>
  );
}

const s = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  attachedCard: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  status: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fileName: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transcriptToggleText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '600',
  },
  transcript: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
});
