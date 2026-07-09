import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { cancelPromiseReminder, schedulePromiseReminder } from '@/lib/notifications';
import { formatMoney } from '@/utils/format';
import type { PaymentPromise } from '@/types/database';

/** True when the 0010 (payment_promises) section of KURULUM.sql hasn't run. */
export function isMissingPromiseTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  return (e.message ?? '').toLowerCase().includes('payment_promises');
}

export function usePromisesForClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['promises', clientId],
    enabled: !!clientId,
    retry: (n, err) => !isMissingPromiseTable(err) && n < 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('client_id', clientId!)
        .order('is_paid')
        .order('due_date');
      if (error) throw error;
      return data as PaymentPromise[];
    },
  });
}

export function useCreatePromise() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      clientName: string;
      amount: number;
      due_date: string;
      note: string | null;
    }) => {
      const { clientName, ...row } = input;
      const { data, error } = await supabase
        .from('payment_promises')
        .insert({ ...row, owner_id: ownerId! })
        .select()
        .single();
      if (error) throw error;
      const promise = data as PaymentPromise;
      await schedulePromiseReminder({
        id: promise.id,
        clientName,
        amountLabel: formatMoney(Number(promise.amount)),
        dueDate: promise.due_date,
      }).catch(() => {});
      return promise;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promises'] }),
  });
}

export function useTogglePromisePaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ promise, clientName }: { promise: PaymentPromise; clientName: string }) => {
      const next = !promise.is_paid;
      const { error } = await supabase.from('payment_promises').update({ is_paid: next }).eq('id', promise.id);
      if (error) throw error;
      if (next) {
        await cancelPromiseReminder(promise.id).catch(() => {});
      } else {
        await schedulePromiseReminder({
          id: promise.id,
          clientName,
          amountLabel: formatMoney(Number(promise.amount)),
          dueDate: promise.due_date,
        }).catch(() => {});
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promises'] }),
  });
}

export function useDeletePromise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_promises').delete().eq('id', id);
      if (error) throw error;
      await cancelPromiseReminder(id).catch(() => {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promises'] }),
  });
}

/** Fee / collected / remaining totals across one client's cases. */
export function useClientFinance(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-finance', clientId],
    enabled: !!clientId,
    retry: 1,
    queryFn: async () => {
      const { data: cases, error } = await supabase
        .from('cases')
        .select('id, fee_amount')
        .eq('client_id', clientId!);
      if (error) throw error;
      const caseIds = (cases ?? []).map((c: { id: string }) => c.id);
      const totalFee = (cases ?? []).reduce(
        (sum: number, c: { fee_amount: number | null }) => sum + (c.fee_amount != null ? Number(c.fee_amount) : 0),
        0
      );
      let collected = 0;
      if (caseIds.length > 0) {
        const { data: payments, error: pErr } = await supabase
          .from('payments')
          .select('amount')
          .in('case_id', caseIds);
        if (pErr && !isMissingPromiseTable(pErr)) throw pErr;
        collected = (payments ?? []).reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0);
      }
      return { totalFee, collected, remaining: Math.max(0, totalFee - collected) };
    },
  });
}
