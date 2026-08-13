import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  PanResponder,
  StyleSheet,
  ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface LightboxProps {
  /** URL strings or bundled sources. Single images must be wrapped in an array. */
  images: (string | ImageSourcePropType)[];
  startIndex?: number;
  visible: boolean;
  onClose: () => void;
}

const SWIPE_THRESHOLD = 40;

function toSource(img: string | ImageSourcePropType): ImageSourcePropType {
  return typeof img === 'string' ? { uri: img } : img;
}

export default function Lightbox({
  images,
  startIndex = 0,
  visible,
  onClose,
}: LightboxProps) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const count = images.length;

  // Keep index reachable from the PanResponder (created once).
  const indexRef = useRef(index);
  indexRef.current = index;
  const countRef = useRef(count);
  countRef.current = count;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      const clamped = Math.min(Math.max(startIndex, 0), Math.max(count - 1, 0));
      setIndex(clamped);
    }
  }, [visible, startIndex, count]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim touches on the image area so taps there don't fall through
        // to the backdrop (legacy: only backdrop/img-wrap closes).
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_evt, gesture) => {
          const { dx, dy } = gesture;
          // A tap (negligible movement) dismisses — legacy closed on
          // img-wrap clicks, not only the backdrop.
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            onCloseRef.current();
            return;
          }
          // Legacy swipe rules: ignore short or vertically-dominant gestures.
          if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) {
            return;
          }
          if (dx < 0) {
            setIndex((i) => Math.min(i + 1, countRef.current - 1));
          } else {
            setIndex((i) => Math.max(i - 1, 0));
          }
        },
      }),
    [],
  );

  if (!visible) return null;

  const safeIndex = Math.min(Math.max(index, 0), Math.max(count - 1, 0));
  const current = count > 0 ? images[safeIndex] : null;
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < count - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop — tap to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {current != null && (
          <View style={styles.imageWrap} {...panResponder.panHandlers}>
            <Image
              source={toSource(current)}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Counter (only when more than one image, legacy parity) */}
        {count > 1 && (
          <View style={[styles.counter, { top: insets.top + Spacing.md }]}>
            <Text style={styles.counterText}>
              {safeIndex + 1} / {count}
            </Text>
          </View>
        )}

        {/* Close */}
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
          style={[styles.closeButton, { top: insets.top + Spacing.md }]}
          hitSlop={8}
        >
          <Ionicons name="close" size={26} color={Colors.text} />
        </Pressable>

        {/* Prev / Next — hidden at the ends, no wraparound */}
        {hasPrev && (
          <Pressable
            onPress={() => setIndex((i) => Math.max(i - 1, 0))}
            accessibilityLabel="Previous"
            accessibilityRole="button"
            style={[styles.navButton, styles.navLeft]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </Pressable>
        )}
        {hasNext && (
          <Pressable
            onPress={() => setIndex((i) => Math.min(i + 1, count - 1))}
            accessibilityLabel="Next"
            accessibilityRole="button"
            style={[styles.navButton, styles.navRight]}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={28} color={Colors.text} />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 14, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrap: {
    width: '100%',
    height: '78%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(26, 34, 52, 0.85)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  counterText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(26, 34, 52, 0.85)',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(26, 34, 52, 0.85)',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: {
    left: Spacing.md,
  },
  navRight: {
    right: Spacing.md,
  },
});
