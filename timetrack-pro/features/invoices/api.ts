import { supabase } from '@/lib/supabase';
import type { Invoice, Profile } from '@/types/database';

export type InvoiceWithProfile = Invoice & {
  profiles: Pick<Profile, 'first_name' | 'last_name' | 'email'> | null;
};

export async function fetchMyInvoices(userId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('issue_date', { ascending: false });
  if (error) throw error;
  return data as Invoice[];
}

export async function fetchAllInvoices(): Promise<InvoiceWithProfile[]> {
  // Backs the admin "Recent Invoices" panel — unbounded history isn't needed.
  const { data, error } = await supabase
    .from('invoices')
    .select('*, profiles(first_name, last_name, email)')
    .order('issue_date', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as unknown as InvoiceWithProfile[];
}

export interface GenerateInvoiceInput {
  userId: string;
  periodStart: string;
  periodEnd: string;
  taxRate?: number;
}

/**
 * Business transaction: collect the period's completed time entries, price
 * them at the employee's current rate, insert the invoice, then its items.
 */
export async function generateInvoice({
  userId,
  periodStart,
  periodEnd,
  taxRate = 0,
}: GenerateInvoiceInput): Promise<Invoice> {
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
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
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
      tax_amount: taxAmount,
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
}
