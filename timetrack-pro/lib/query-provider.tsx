import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
      retry: 1,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
