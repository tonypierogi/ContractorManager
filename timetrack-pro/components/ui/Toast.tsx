import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';

type ToastType = 'success' | 'error';

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

// Imperative bridge so non-React code (e.g. the React Query mutation cache)
// can fire toasts. Set while a ToastProvider is mounted.
export const toastRef: { current: ToastContextValue['showToast'] | null } = {
  current: null,
};

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const insets = useSafeAreaInsets();

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (timeout.current) clearTimeout(timeout.current);
    const id = Date.now();
    setToast({ message, type, id });
  }, []);

  useEffect(() => {
    toastRef.current = showToast;
    return () => {
      toastRef.current = null;
    };
  }, [showToast]);

  useEffect(() => {
    if (!toast) return;

    translateY.setValue(-100);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();

    timeout.current = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 3000);

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [toast?.id]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            { top: insets.top + Spacing.sm },
            { transform: [{ translateY }] },
            toast.type === 'success' ? styles.success : styles.error,
          ]}
        >
          <Text style={styles.text}>
            {toast.type === 'success' ? '✓ ' : '✕ '}
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    zIndex: 9999,
    borderWidth: 1,
    ...Shadows.md,
  },
  success: {
    backgroundColor: Colors.bgPanel,
    borderColor: Colors.success,
  },
  error: {
    backgroundColor: Colors.bgPanel,
    borderColor: Colors.danger,
  },
  text: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
