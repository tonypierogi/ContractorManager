import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
}

/**
 * iOS-style bottom sheet: slides up from the bottom edge, rounded top corners,
 * a grabber, and a dimmed backdrop that closes on tap. Used where a centered
 * dialog (components/ui/Modal) would read as an interruption rather than as
 * "more detail about the thing you just tapped".
 */
export default function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <TouchableWithoutFeedback onPress={onClose} accessible={false}>
          <View style={s.backdrop} />
        </TouchableWithoutFeedback>

        <View style={s.sheet}>
          <View style={s.grabberRow}>
            <View style={s.grabber} />
          </View>
          <View style={s.header}>
            <View style={s.headerText}>
              <Text style={s.title}>{title}</Text>
              {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={s.closeButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={s.body}
            contentContainerStyle={[
              s.bodyContent,
              { paddingBottom: Spacing.lg + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 26, 0.75)',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: Colors.bgPanel,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
    ...Shadows.lg,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: Spacing.lg,
  },
});
