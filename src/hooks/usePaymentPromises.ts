import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addMonths, format } from 'date-fns';
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

/** True when the 0021 (taksit kolonları) section of KURULUM.sql hasn't run. */
export function isMissingInstallmentColumns(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42703' || e.code === 'PGRST204') return true;
  return (e.message ?? '').toLowerCase().includes('group_id');
}

// Taksit planını gruplamak için istemci tarafında üretilen v4 UUID.
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type PromiseWithClient = PaymentPromise & { client: { id: string; full_name: string } | null };

/** Ödenmemiş tüm ödeme sözleri — takvimde göstermek için. */
export function useAllPromises() {
  const ownerId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['promises', 'all', ownerId],
    enabled: !!ownerId,
    retry: (n, err) => !isMissingPromiseTable(err) && n < 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_promises')
        .select('*, client:clients(id, full_name)')
        .eq('owner_id', ownerId!)
        .eq('is_paid', false)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as unknown as PromiseWithClient[];
    },
  });
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

/** Bir alacağı eşit taksitlere bölerek her taksit için ayrı söz + hatırlatıcı oluşturur. */
export function useCreatePromiseInstallments() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      clientName: string;
      total: number;
      count: number;
      firstDue: Date;
      note: string | null;
    }) => {
      const { clientName, total, count, firstDue, ...rest } = input;
      const group_id = uuidv4();
      // Kuruş kaybı olmasın: son taksit yuvarlama farkını üstlenir.
      const per = Math.floor((total / count) * 100) / 100;
      const last = Math.round((total - per * (count - 1)) * 100) / 100;
      const rows = Array.from({ length: count }, (_, i) => ({
        ...rest,
        owner_id: ownerId!,
        amount: i === count - 1 ? last : per,
        due_date: format(addMonths(firstDue, i), 'yyyy-MM-dd'),
        group_id,
        seq: i + 1,
        total_count: count,
      }));
      const { data, error } = await supabase.from('payment_promises').insert(rows).select();
      if (error) throw error;
      const promises = data as PaymentPromise[];
      for (const p of promises) {
        await schedulePromiseReminder({
          id: p.id,
          clientName,
          amountLabel: `${formatMoney(Number(p.amount))} (${p.seq}/${p.total_count})`,
          dueDate: p.due_date,
        }).catch(() => {});
      }
      return promises;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promises'] }),
  });
}

/** Taksit tutarları elle belirlenmiş bir plan oluşturur (her ay eşit olmak zorunda değil). */
export function useCreateCustomInstallments() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      clientName: string;
      rows: { amount: number; due_date: string }[];
      note: string | null;
    }) => {
      const { client_id, clientName, rows, note } = input;
      const group_id = uuidv4();
      const total_count = rows.length;
      const payload = rows.map((r, i) => ({
        client_id,
        note,
        owner_id: ownerId!,
        amount: r.amount,
        due_date: r.due_date,
        group_id,
        seq: i + 1,
        total_count,
      }));
      const { data, error } = await supabase.from('payment_promises').insert(payload).select();
      if (error) throw error;
      const promises = data as PaymentPromise[];
      for (const p of promises) {
        await schedulePromiseReminder({
          id: p.id,
          clientName,
          amountLabel: `${formatMoney(Number(p.amount))} (${p.seq}/${p.total_count})`,
          dueDate: p.due_date,
        }).catch(() => {});
      }
      return promises;
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
