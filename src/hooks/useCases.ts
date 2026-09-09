import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DOCUMENTS_BUCKET, supabase } from '@/lib/supabase';
import { notifySaveError } from '@/lib/saveError';
import { useAuthStore } from '@/store/authStore';
import type { Case, CaseStatus, CaseWithClient, PriorityLevel } from '@/types/database';

const CASE_SELECT = '*, client:clients(id, full_name, company)';

interface CaseFilters {
  search?: string;
  status?: 'all' | 'open' | 'closed';
}

export function useCases(filters: CaseFilters = {}) {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['cases', ownerId, filters.search ?? '', filters.status ?? 'all'],
    enabled: !!ownerId,
    queryFn: async () => {
      // Alıcı geri bildirimi: dava dizini açılış tarihine göre dizilir (yeni → eski).
      let query = supabase
        .from('cases')
        .select(CASE_SELECT)
        .eq('owner_id', ownerId!)
        .order('opened_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.status === 'open') query = query.in('status', ['active', 'pending', 'on_hold']);
      else if (filters.status === 'closed') query = query.in('status', ['closed', 'won', 'lost']);
      if (filters.search) query = query.ilike('title', `%${filters.search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as CaseWithClient[];
    },
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ['cases', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('cases').select(CASE_SELECT).eq('id', id!).single();
      if (error) throw error;
      return data as unknown as CaseWithClient;
    },
  });
}

export function useCasesByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['cases', 'byClient', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('client_id', clientId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Case[];
    },
  });
}

export type CaseInput = Pick<
  Case,
  | 'title'
  | 'client_id'
  | 'case_number'
  | 'court_name'
  | 'court_category'
  | 'case_type'
  | 'opposing_counsel'
  | 'instance_stage'
  | 'case_stage'
  | 'closed_result'
  | 'decision_number'
  | 'decision_date'
  | 'decision_served_date'
  | 'advance_amount'
  | 'stage_note'
  | 'fee_type'
  | 'fee_percent'
  | 'fee_advance'
  | 'status'
  | 'priority'
  | 'opposing_party'
  | 'description'
  | 'opened_date'
  | 'fee_amount'
>;

// If the optional finance migration (0005) hasn't been applied yet, the
// `fee_amount` column is missing and PostgREST rejects the whole write. Detect
// that specific case and transparently retry without the column so case
// creation keeps working; any other error is surfaced to the caller.
function isMissingFeeColumn(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? '';
  return message.includes('fee_amount');
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (input: Partial<CaseInput> & { title: string }) => {
      const insert = async (payload: Record<string, unknown>) =>
        supabase.from('cases').insert(payload).select(CASE_SELECT).single();

      let { data, error } = await insert({ ...input, owner_id: ownerId! });
      if (error && isMissingFeeColumn(error)) {
        const { fee_amount: _drop, ...rest } = input;
        ({ data, error } = await insert({ ...rest, owner_id: ownerId! }));
      }
      if (error) throw error;
      return data as unknown as CaseWithClient;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cases'] }),
  });
}

export function useUpdateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async ({
      id,
      ...input
    }: Partial<CaseInput> & { id: string; status?: CaseStatus; priority?: PriorityLevel }) => {
      const update = async (payload: Record<string, unknown>) =>
        supabase.from('cases').update(payload).eq('id', id).select(CASE_SELECT).single();

      let { data, error } = await update(input);
      if (error && isMissingFeeColumn(error)) {
        const { fee_amount: _drop, ...rest } = input;
        ({ data, error } = await update(rest));
      }
      if (error) throw error;
      return data as unknown as CaseWithClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

/**
 * DAVA SİLİNİNCE MÜVEKKİL BELGELERİ DEPODA KALIYORDU.
 *
 * BULUNAN KUSUR. `documents.case_id` şeması `on delete cascade` (0001_init.sql
 * satır 144). Yani dava silindiğinde belge SATIRLARI veritabanından gidiyordu
 * ama DOSYALAR Supabase Storage'da kalıyordu — üstelik satırlar silindiği için
 * uygulama üzerinden bir daha ULAŞILAMAZ hâlde. Kalıcı, görünmez, temizlenemez
 * artık.
 *
 * NEDEN CİDDİ. Bir hukuk uygulamasında bu yalnız depolama maliyeti değil:
 * avukat davayı silerken müvekkilin belgelerinin de gittiğini varsayar. Sır
 * saklama yükümlülüğü ve KVKK açısından "sildim" denen verinin durmaya devam
 * etmesi, kullanıcıya söylenenle olanın ayrışmasıdır. Tek belge silmede bu
 * doğru yapılıyordu (useDeleteDocument dosyayı da siliyor); eksik olan, davayla
 * birlikte toplu silmeydi.
 *
 * SIRA ÖNEMLİ: önce dosyalar, sonra satır. Ters sırada dava silinseydi
 * cascade belge satırlarını da silerdi ve elimizde silinecek dosyaların
 * YOLLARI kalmazdı — artık kalıcı olurdu.
 *
 * DOSYA SİLME BAŞARISIZ OLURSA DAVA DA SİLİNMEZ. Sessizce devam etmek, "sildim"
 * deyip müvekkil belgesini bırakmak demektir; kullanıcı hatayı görüp tekrar
 * deneyebilsin. Silinecek belgesi olmayan davada bu yol hiç çalışmaz.
 */
async function davaBelgeleriniDepodanSil(caseId: string): Promise<void> {
  const { data, error } = await supabase.from('documents').select('file_path').eq('case_id', caseId);
  if (error) throw error;

  const yollar = (data ?? []).map((d) => (d as { file_path: string }).file_path).filter(Boolean);
  if (yollar.length === 0) return;

  // Storage.remove tek çağrıda çok sayıda yol kabul etmeyebilir; parçalayarak
  // gönderiyoruz ki çok belgeli bir dava sessizce yarım silinmesin.
  const PARCA = 100;
  for (let i = 0; i < yollar.length; i += PARCA) {
    const { error: depoHatasi } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove(yollar.slice(i, i + PARCA));
    if (depoHatasi) throw depoHatasi;
  }
}

export function useDeleteCase() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      await davaBelgeleriniDepodanSil(id);
      const { error } = await supabase.from('cases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      // Belge satırları cascade ile gitti; belge listeleri de tazelenmeli.
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
