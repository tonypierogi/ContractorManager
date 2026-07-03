import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddMemberModal({ visible, onClose }: AddMemberModalProps) {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const inviteLink = Platform.select({
    web: `${typeof window !== 'undefined' ? window.location.origin : ''}?invite=true`,
    default: 'Share the app link with your team member to join.',
  });

  async function handleCopy() {
    if (typeof inviteLink === 'string') {
      await Clipboard.setStringAsync(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose() {
    setEmail('');
    setCopied(false);
    onClose();
  }

  return (
    <Modal visible={visible} onClose={handleClose} title="Add Team Member">
      <Text style={styles.sectionTitle}>Invite Link</Text>
      <View style={styles.linkBox}>
        <Text style={styles.linkText} numberOfLines={2} selectable>
          {inviteLink}
        </Text>
      </View>
      <View style={styles.copyRow}>
        <Button
          title={copied ? 'Copied!' : 'Copy Link'}
          variant={copied ? 'ghost' : 'secondary'}
          size="sm"
          onPress={handleCopy}
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Find by Email</Text>
      <Input
        placeholder="team@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Button title="Search" variant="primary" onPress={() => {}} fullWidth disabled={!email} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  linkBox: {
    backgroundColor: Colors.bgElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyRow: {
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
});
