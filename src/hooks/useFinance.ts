import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notifySaveError } from '@/lib/saveError';
import { tabloYokMu } from '@/utils/tabloYok';
import { tumSayfalar } from '@/utils/sayfalama';
import { useAuthStore } from '@/store/authStore';
import type { FinanceEntry } from '@/types/database';

/** True when the 0006_office_finance.sql migration hasn't been run yet. */
export function isMissingFinanceTable(err: unknown): boolean {
  // Yalnız gerçek "tablo yok" hatası; kısıt/RLS hatası tablo adı taşısa da sayılmaz.
  return tabloYokMu(err, 'finance_entries');
}

export function useFinanceEntries() {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['finance', 'entries', ownerId],
    enabled: !!ownerId,
    retry: (failureCount, error) => !isMissingFinanceTable(error) && failureCount < 1,
    // Sayfa sayfa: tek sorgu PostgREST satır tavanında (varsayılan 1000)
    // sessizce kesilir, en eski kalemler aylık toplamlardan düşerdi
    // (bkz. utils/sayfalama). Sıra benzersiz: sonda `id`.
    queryFn: async () =>
      (await tumSayfalar((bas, son) =>
        supabase
          .from('finance_entries')
          .select('*', { count: 'exact' })
          .eq('owner_id', ownerId!)
          .order('entry_date', { ascending: false })
          .order('id', { ascending: true })
          .range(bas, son),
      )) as FinanceEntry[],
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
  vat_rate?: number | null;
  withholding_rate?: number | null;
  receipt_no?: string | null;
  receipt_issued?: boolean;
}

export function useCreateFinanceEntry() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
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
    onError: notifySaveError,
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
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('finance_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance'] }),
  });
}
