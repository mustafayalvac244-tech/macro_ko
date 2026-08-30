import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notifySaveError } from '@/lib/saveError';
import { useAuthStore } from '@/store/authStore';

/** Vekaletname türü. */
export type PoaKind = 'genel' | 'ozel' | 'bosanma' | 'tanima_tenfiz';
/** Vekaletname durumu. */
export type PoaStatus = 'aktif' | 'azil' | 'istifa' | 'suresi_doldu';

/** HMK m.74 uyarınca ayrıca yetki verilmesi gereken işlemler. */
export const SPECIAL_AUTHORITIES = [
  'auth_sulh',
  'auth_feragat',
  'auth_kabul',
  'auth_ahzu_kabz',
  'auth_temyiz',
  'auth_tahkim',
  'auth_isticvap',
] as const;
export type SpecialAuthority = (typeof SPECIAL_AUTHORITIES)[number];

export interface PowerOfAttorney {
  id: string;
  owner_id: string;
  client_id: string | null;
  kind: PoaKind;
  notary_name: string | null;
  notary_no: string | null;
  issued_date: string | null;
  valid_until: string | null;
  auth_sulh: boolean;
  auth_feragat: boolean;
  auth_kabul: boolean;
  auth_ahzu_kabz: boolean;
  auth_temyiz: boolean;
  auth_tahkim: boolean;
  auth_isticvap: boolean;
  status: PoaStatus;
  status_date: string | null;
  document_path: string | null;
  notes: string | null;
  created_at: string;
  client?: { id: string; full_name: string } | null;
}

export type PoaInput = Omit<PowerOfAttorney, 'id' | 'owner_id' | 'created_at' | 'client'>;

/** Süresi geçmiş mi? (durum alanı elle değişmemiş olsa da hesaplanır) */
export function isExpired(p: PowerOfAttorney): boolean {
  if (!p.valid_until) return false;
  const d = new Date(p.valid_until);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

/** Fiilen kullanılabilir mi? */
export function isUsable(p: PowerOfAttorney): boolean {
  return p.status === 'aktif' && !isExpired(p);
}

export function usePowersOfAttorney(clientId?: string) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['poa', userId, clientId ?? 'all'],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase
        .from('powers_of_attorney')
        .select('*, client:clients(id, full_name)')
        .eq('owner_id', userId!)
        .order('issued_date', { ascending: false, nullsFirst: false });
      if (clientId) q = q.eq('client_id', clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as PowerOfAttorney[];
    },
  });
}

export function useCreatePoa() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    onError: notifySaveError,
    mutationFn: async (input: Partial<PoaInput>) => {
      const { error } = await supabase.from('powers_of_attorney').insert({ ...input, owner_id: userId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['poa'] }),
  });
}

export function useUpdatePoa() {
  const qc = useQueryClient();
  return useMutation({
    onError: notifySaveError,
    mutationFn: async ({ id, ...patch }: Partial<PoaInput> & { id: string }) => {
      const { error } = await supabase
        .from('powers_of_attorney')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['poa'] }),
  });
}

export function useDeletePoa() {
  const qc = useQueryClient();
  return useMutation({
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('powers_of_attorney').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['poa'] }),
  });
}
