import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { FinanceEntry } from '@/types/database';

/** True when the 0006_office_finance.sql migration hasn't been run yet. */
export function isMissingFinanceTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  return (e.message ?? '').toLowerCase().includes('finance_entries');
}

export function useFinanceEntries() {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['finance', 'entries', ownerId],
    enabled: !!ownerId,
    retry: (failureCount, error) => !isMissingFinanceTable(error) && failureCount < 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_entries')
        .select('*')
        .eq('owner_id', ownerId!)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return data as FinanceEntry[];
    },
  });
}

export interface FinanceEntryInput {
  kind: FinanceEntry['kind'];
  category: FinanceEntry['category'];
  title: string;
  amount: number;
  entry_date: string;
  is_recurring: boolean;
  note: string | null;
}

export function useCreateFinanceEntry() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: FinanceEntryInput) => {
      const { data, error } = await supabase
        .from('finance_entries')
        .insert({ ...input, owner_id: ownerId! })
        .select()
        .single();
      if (error) throw error;
      return data as FinanceEntry;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance'] }),
  });
}

export function useUpdateFinanceEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<FinanceEntry>) => {
      const { error } = await supabase.from('finance_entries').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance'] }),
  });
}

export function useDeleteFinanceEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('finance_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance'] }),
  });
}
