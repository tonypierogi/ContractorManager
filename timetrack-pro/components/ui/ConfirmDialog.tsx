import { View, Text, StyleSheet } from 'react-native';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Colors, Spacing, FontSize } from '@/constants/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Yes/no confirmation for destructive or hard-to-undo actions. React Native's
 * Alert.alert is a no-op on react-native-web, so anything a contractor might
 * hit in the browser build confirms through this modal instead.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Back',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} onClose={onCancel} title={title} size="sm">
      <Text style={s.message}>{message}</Text>
      <View style={s.actions}>
        <Button
          title={cancelLabel}
          onPress={onCancel}
          variant="secondary"
          size="sm"
        />
        <Button
          title={confirmLabel}
          onPress={onConfirm}
          variant={destructive ? 'danger' : 'primary'}
          size="sm"
          loading={loading}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
