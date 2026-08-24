import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notifySaveError } from '@/lib/saveError';
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
    onError: notifySaveError,
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
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_advances').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-advances'] }),
  });
}

/** Masraf avansı eksiye düşen (harcanan > yatırılan) müvekkiller — ana ekran uyarısı. */
export interface AdvanceDeficit {
  id: string;
  name: string;
  deficit: number; // pozitif tutar: istenmesi gereken ek avans
}

export function useAdvanceDeficits() {
  const ownerId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['advance-deficits'],
    enabled: !!ownerId,
    staleTime: 60_000,
    retry: (n, err) => !isMissingAdvanceTable(err) && n < 1,
    queryFn: async (): Promise<AdvanceDeficit[]> => {
      const { data: clients } = await supabase.from('clients').select('id, full_name, company');
      const nameById = new Map(
        (clients ?? []).map((c: { id: string; full_name: string; company: string | null }) => [
          c.id,
          c.company || c.full_name,
        ])
      );

      const deposited = new Map<string, number>();
      const spent = new Map<string, number>();
      const add = (m: Map<string, number>, id: string | null | undefined, amt: number) => {
        if (id) m.set(id, (m.get(id) ?? 0) + amt);
      };

      // Yatırılan avanslar
      const adv = await supabase.from('client_advances').select('client_id, amount');
      (adv.data ?? []).forEach((r: { client_id: string; amount: number }) => add(deposited, r.client_id, Number(r.amount)));

      // Elle girilen müvekkil masrafları
      const cexp = await supabase.from('client_expenses').select('client_id, amount');
      (cexp.data ?? []).forEach((r: { client_id: string; amount: number }) => add(spent, r.client_id, Number(r.amount)));

      // Davaya bağlı masraflar (case_expenses → cases.client_id)
      const cs = await supabase.from('cases').select('id, client_id');
      const clientOfCase = new Map(
        (cs.data ?? []).map((c: { id: string; client_id: string | null }) => [c.id, c.client_id])
      );
      const ce = await supabase.from('case_expenses').select('case_id, amount');
      (ce.data ?? []).forEach((r: { case_id: string; amount: number }) =>
        add(spent, clientOfCase.get(r.case_id) ?? null, Number(r.amount))
      );

      const out: AdvanceDeficit[] = [];
      const ids = new Set<string>([...deposited.keys(), ...spent.keys()]);
      ids.forEach((id) => {
        const balance = (deposited.get(id) ?? 0) - (spent.get(id) ?? 0);
        if (balance < 0) out.push({ id, name: nameById.get(id) ?? '—', deficit: -balance });
      });
      return out.sort((a, b) => b.deficit - a.deficit);
    },
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
    onError: notifySaveError,
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
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-expenses'] }),
  });
}
