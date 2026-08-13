import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { fetchAllInvoices, fetchMyInvoices, generateInvoice } from './api';

export function useInvoices(userId: string) {
  return useQuery({
    queryKey: qk.invoices.mine(userId),
    queryFn: () => fetchMyInvoices(userId),
    enabled: !!userId,
  });
}

export function useAllInvoices() {
  return useQuery({
    queryKey: qk.invoices.list,
    queryFn: fetchAllInvoices,
  });
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.invoices.all });
    },
  });
}
