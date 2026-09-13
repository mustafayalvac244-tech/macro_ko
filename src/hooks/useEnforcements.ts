import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notifySaveError } from '@/lib/saveError';
import { onbellekYamasi } from '@/utils/onbellekYamasi';
import { useAuthStore } from '@/store/authStore';
import type {
  EnforcementCollection,
  EnforcementFile,
  EnforcementWithClient,
} from '@/types/database';

const ENF_SELECT = '*, client:clients(id, full_name, company)';

/** True when the 0024 (enforcement) section of KURULUM.sql hasn't run. */
export function isMissingEnforcementTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  return (e.message ?? '').toLowerCase().includes('enforcement');
}

export function useEnforcements(search?: string) {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['enforcements', ownerId, search ?? ''],
    enabled: !!ownerId,
    retry: (n, err) => !isMissingEnforcementTable(err) && n < 1,
    queryFn: async () => {
      let query = supabase
        .from('enforcement_files')
        .select(ENF_SELECT)
        .eq('owner_id', ownerId!)
        .order('start_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (search) query = query.ilike('debtor_name', `%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as EnforcementWithClient[];
    },
  });
}

export function useEnforcement(id: string | undefined) {
  return useQuery({
    queryKey: ['enforcements', 'detail', id],
    enabled: !!id,
    retry: (n, err) => !isMissingEnforcementTable(err) && n < 1,
    queryFn: async () => {
      const { data, error } = await supabase.from('enforcement_files').select(ENF_SELECT).eq('id', id!).single();
      if (error) throw error;
      return data as unknown as EnforcementWithClient;
    },
  });
}

export function useEnforcementsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['enforcements', 'byClient', clientId],
    enabled: !!clientId,
    retry: (n, err) => !isMissingEnforcementTable(err) && n < 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enforcement_files')
        .select('*')
        .eq('client_id', clientId!)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data as EnforcementFile[];
    },
  });
}

export type EnforcementInput = Pick<
  EnforcementFile,
  | 'client_id'
  | 'debtor_name'
  | 'debtor_id_no'
  | 'debtor_address'
  | 'office_name'
  | 'file_number'
  | 'takip_type'
  | 'principal'
  | 'pre_interest'
  | 'interest_rate'
  | 'start_date'
  | 'expenses'
  | 'attorney_fee'
  | 'notes'
>;

export function useCreateEnforcement() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (input: EnforcementInput) => {
      const { data, error } = await supabase
        .from('enforcement_files')
        .insert({ ...input, owner_id: ownerId! })
        .select()
        .single();
      if (error) throw error;
      return data as EnforcementFile;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enforcements'] }),
  });
}

export function useUpdateEnforcement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<EnforcementFile> & { id: string }) => {
      const { data, error } = await supabase.from('enforcement_files').update(rest).eq('id', id).select().single();
      if (error) throw error;
      return data as EnforcementFile;
    },

    /**
     * İYİMSER GÜNCELLEME — "Safha" rozetleri geç geçiyordu.
     *
     * Eskiden ekrandaki seçim, sunucudan İKİ kez dönülmeden kımıldamıyordu:
     * önce UPDATE, sonra invalidate'in tetiklediği refetch. Yavaş bağlantıda
     * bu "tıkladım, olmadı" hissi veriyor ve kullanıcı tekrar dokunuyor —
     * yani ikinci bir yazma daha üretiyordu.
     *
     * Artık önbellek hemen yamanıyor; sunucu cevabı arkadan geliyor. Hata
     * olursa yama geri alınıyor ve kullanıcıya söyleniyor: sessizce yanlış
     * safhayı göstermek, gecikmeden kötüdür.
     */
    onMutate: async ({ id, ...rest }) => {
      await queryClient.cancelQueries({ queryKey: ['enforcements'] });
      const oncekiler = queryClient.getQueriesData({ queryKey: ['enforcements'] });
      queryClient.setQueriesData({ queryKey: ['enforcements'] }, (eski) =>
        onbellekYamasi<EnforcementFile>(eski, id, rest),
      );
      return { oncekiler };
    },
    onError: (err, _degiskenler, baglam) => {
      baglam?.oncekiler.forEach(([anahtar, veri]) => queryClient.setQueryData(anahtar, veri));
      notifySaveError(err);
    },
    // Başarıda da hatada da sunucudaki gerçekle hizalan.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['enforcements'] }),
  });
}

export function useDeleteEnforcement() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('enforcement_files').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enforcements'] }),
  });
}

/* ---------------- Tahsilatlar ---------------- */

export function useCollections(enforcementId: string | undefined) {
  return useQuery({
    queryKey: ['enforcement-collections', enforcementId],
    enabled: !!enforcementId,
    retry: (n, err) => !isMissingEnforcementTable(err) && n < 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enforcement_collections')
        .select('*')
        .eq('enforcement_id', enforcementId!)
        .order('collected_at', { ascending: false });
      if (error) throw error;
      return data as EnforcementCollection[];
    },
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (input: {
      enforcement_id: string;
      amount: number;
      collected_at: string;
      source: EnforcementCollection['source'];
      note: string | null;
    }) => {
      const { error } = await supabase.from('enforcement_collections').insert({ ...input, owner_id: ownerId! });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enforcement-collections'] }),
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('enforcement_collections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enforcement-collections'] }),
  });
}
