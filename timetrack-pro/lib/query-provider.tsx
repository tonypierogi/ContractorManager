import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query';
import { toastRef } from '@/components/ui/Toast';

const queryClient = new QueryClient({
  // Every mutation error surfaces to the user unless the mutation opts out
  // with meta: { suppressGlobalError: true } and handles it itself.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressGlobalError) return;
      const message =
        error instanceof Error ? error.message : 'Something went wrong';
      toastRef.current?.(message, 'error');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 10,
      retry: 1,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // refetchOnWindowFocus does nothing on native unless the focus manager is
  // wired to AppState; web already gets window focus events for free.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
