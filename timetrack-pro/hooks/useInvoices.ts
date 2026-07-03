import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Invoice } from '@/types/database';

export function useInvoices(userId: string) {
  return useQuery({
    queryKey: ['invoices', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('issue_date', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!userId,
  });
}

export function useAllInvoices() {
  return useQuery({
    queryKey: ['allInvoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, profiles(first_name, last_name, email)')
        .order('issue_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      periodStart,
      periodEnd,
      taxRate = 0,
    }: {
      userId: string;
      periodStart: string;
      periodEnd: string;
      taxRate?: number;
    }) => {
      const endDate = new Date(periodEnd);
      endDate.setDate(endDate.getDate() + 1);

      const { data: entries, error: entriesError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('clock_in', new Date(periodStart).toISOString())
        .lt('clock_in', endDate.toISOString())
        .not('clock_out', 'is', null)
        .order('clock_in', { ascending: true });
      if (entriesError) throw entriesError;
      if (!entries || entries.length === 0) {
        throw new Error('No completed time entries found for this period');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', userId)
        .single();
      if (profileError) throw profileError;

      const rate = profile.hourly_rate ?? 0;
      let totalHours = 0;
      entries.forEach((e) => {
        totalHours +=
          (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) /
          3_600_000;
      });

      const subtotal = totalHours * rate;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;
      const invoiceNumber = `INV-${Date.now()}`;
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 30);

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          user_id: userId,
          status: 'draft',
          issue_date: now.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          period_start: periodStart,
          period_end: periodEnd,
          subtotal,
          tax_rate: taxRate,
          tax_amount: tax,
          total,
        })
        .select()
        .single();
      if (invoiceError) throw invoiceError;

      const invoiceItems = entries.map((entry) => {
        const hours =
          (new Date(entry.clock_out!).getTime() -
            new Date(entry.clock_in).getTime()) /
          3_600_000;
        return {
          invoice_id: invoice.id,
          time_entry_id: entry.id,
          description: entry.description || 'Professional Services',
          hours,
          rate,
          amount: hours * rate,
        };
      });

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);
      if (itemsError) throw itemsError;

      return invoice as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
    },
  });
}
