import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { ClientAdvance, ClientExpense } from '@/types/database';

/** True when the 0023 (client_advances) section of KURULUM.sql hasn't run. */
export function isMissingAdvanceTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  return (e.message ?? '').toLowerCase().includes('client_advances');
}

/** Bir müvekkil için yatırılan masraf avansı depozitleri. */
export function useClientAdvances(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-advances', clientId],
    enabled: !!clientId,
    retry: (n, err) => !isMissingAdvanceTable(err) && n < 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_advances')
        .select('*')
        .eq('client_id', clientId!)
        .order('deposited_at', { ascending: false });
      if (error) throw error;
      return data as ClientAdvance[];
    },
  });
}

/** Müvekkilin tüm davalarındaki toplam masraf harcaması (case_expenses). */
export function useClientExpensesTotal(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-expenses-total', clientId],
    enabled: !!clientId,
    retry: 1,
    queryFn: async () => {
      const { data: cases, error } = await supabase
        .from('cases')
        .select('id')
        .eq('client_id', clientId!);
      if (error) throw error;
      const caseIds = (cases ?? []).map((c: { id: string }) => c.id);
      if (caseIds.length === 0) return 0;
      const { data: expenses, error: eErr } = await supabase
        .from('case_expenses')
        .select('amount')
        .in('case_id', caseIds);
      if (eErr) throw eErr;
      return (expenses ?? []).reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0);
    },
  });
}

export function useCreateClientAdvance() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: { client_id: string; amount: number; note: string | null }) => {
      const { error } = await supabase.from('client_advances').insert({ ...input, owner_id: ownerId! });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-advances'] }),
  });
}

export function useDeleteClientAdvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_advances').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-advances'] }),
  });
}

/* ---- Müvekkil bazlı elle masraflar (davaya bağlı olmayanlar) ---- */

export function useClientExpenses(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-expenses', clientId],
    enabled: !!clientId,
    retry: (n, err) => !isMissingAdvanceTable(err) && n < 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_expenses')
        .select('*')
        .eq('client_id', clientId!)
        .order('spent_at', { ascending: false });
      if (error) throw error;
      return data as ClientExpense[];
    },
  });
}

export function useCreateClientExpense() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: { client_id: string; amount: number; title: string | null }) => {
      const { error } = await supabase.from('client_expenses').insert({ ...input, owner_id: ownerId! });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-expenses'] }),
  });
}

export function useDeleteClientExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-expenses'] }),
  });
}
