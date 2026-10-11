import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { notifySaveError } from '@/lib/saveError';
import { tabloYokMu } from '@/utils/tabloYok';
import { tumSayfalar } from '@/utils/sayfalama';
import { useAuthStore } from '@/store/authStore';
import type { TimeEntry, TimeEntryWithCase } from '@/types/database';

/**
 * 0131_zaman_kaydi.sql henüz koşulmamışsa true.
 *
 * useFinance.ts ile aynı desen ve aynı sebep: göç sırası kullanıcıdan
 * bağımsız ilerliyor. Tablo yoksa ekran boş liste gösterip sessizce
 * devam etmeli — tekrar tekrar deneyip hata kusmamalı.
 */
export function isMissingTimeTable(err: unknown): boolean {
  // Yalnız gerçek "tablo yok" hatası; kısıt/RLS hatası tablo adı taşısa da sayılmaz.
  return tabloYokMu(err, 'time_entries');
}

const yenidenDene = (failureCount: number, error: unknown) =>
  !isMissingTimeTable(error) && failureCount < 1;

/** Tek dosyanın çalışma kayıtları — dosya ekranındaki sekme için. */
export function useTimeEntriesForCase(caseId: string | undefined) {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['time-entries', 'byCase', caseId],
    enabled: !!ownerId && !!caseId,
    retry: yenidenDene,
    // Sayfa sayfa: tek sorgu PostgREST satır tavanında (varsayılan 1000)
    // sessizce kesilirdi (bkz. utils/sayfalama). Sıra benzersiz: sonda `id`.
    queryFn: async () =>
      (await tumSayfalar((bas, son) =>
        supabase
          .from('time_entries')
          .select('*', { count: 'exact' })
          .eq('case_id', caseId!)
          .order('worked_at', { ascending: false })
          .order('id', { ascending: true })
          .range(bas, son),
      )) as TimeEntry[],
  });
}

/**
 * Sahibin tüm kayıtları, dosya adıyla birlikte — rapor ekranı ve zaman
 * listesi için. Dosyasız kayıtlarda `cases` null gelir.
 */
export function useAllTimeEntries() {
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ['time-entries', 'all', ownerId],
    enabled: !!ownerId,
    retry: yenidenDene,
    // Sayfa sayfa (bkz. yukarıdaki not): rapor toplamı eksik kayıtla yanlış çıkardı.
    queryFn: async () =>
      (await tumSayfalar((bas, son) =>
        supabase
          .from('time_entries')
          .select('*, cases ( id, title )', { count: 'exact' })
          .eq('owner_id', ownerId!)
          .order('worked_at', { ascending: false })
          .order('id', { ascending: true })
          .range(bas, son),
      )) as unknown as TimeEntryWithCase[],
  });
}

export interface TimeEntryInput {
  case_id: string | null;
  description: string;
  minutes: number;
  worked_at: string;
  billable: boolean;
  hourly_rate: number | null;
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (input: TimeEntryInput) => {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({ ...input, owner_id: ownerId! })
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async ({ id, ...patch }: Partial<TimeEntryInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
  });
}

/**
 * Profildeki varsayılan saatlik ücret.
 *
 * Kayda KOPYALANIR, referans verilmez: avukat tarifesini yıl ortasında
 * yükseltirse geçmiş kayıtların tutarı değişmemeli.
 */
export function useUpdateHourlyRate() {
  const queryClient = useQueryClient();
  const ownerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    onError: notifySaveError,
    mutationFn: async (hourly_rate: number | null) => {
      const { error } = await supabase
        .from('profiles')
        .update({ hourly_rate })
        .eq('id', ownerId!);
      if (error) throw error;
      return hourly_rate;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}
