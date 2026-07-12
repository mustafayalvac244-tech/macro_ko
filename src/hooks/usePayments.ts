import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { CaseExpense, Payment } from '@/types/database';

export function usePaymentsForCase(caseId: string | undefined) {
  return useQuery({
    queryKey: ['payments', 'byCase', caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('case_id', caseId!)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });
}

export function useAllPayments() {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['payments', 'all', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('amount, case_id, paid_at')
        .eq('owner_id', ownerId!);
      if (error) throw error;
      return data as Pick<Payment, 'amount' | 'case_id' | 'paid_at'>[];
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: { case_id: string; amount: number; note: string | null }) => {
      const { data, error } = await supabase
        .from('payments')
        .insert({ ...input, owner_id: ownerId! })
        .select()
        .single();
      if (error) throw error;
      return data as Payment;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });
}


/* ---------------- Masraf avansı defteri ---------------- */


export function useCaseExpenses(caseId: string | undefined) {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['case-expenses', caseId],
    enabled: !!ownerId && !!caseId,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('case_expenses')
        .select('*')
        .eq('case_id', caseId!)
        .order('spent_at', { ascending: false });
      if (error) throw error;
      return data as CaseExpense[];
    },
  });
}

export function useCreateCaseExpense() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: { case_id: string; title: string; amount: number }) => {
      const { error } = await supabase.from('case_expenses').insert({ ...input, owner_id: ownerId! });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case-expenses'] }),
  });
}

export function useDeleteCaseExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('case_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case-expenses'] }),
  });
}
