import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BriefSections {
  acilis: string;
  dayanaklar: string;
  tanik: string;
  karsi: string;
  sonrasi: string;
}

export interface WarPlanContent {
  brief?: Partial<BriefSections>;
  checklist?: Record<string, boolean>;
  notes?: Array<{ at: string; text: string }>;
  debrief?: { good?: string; bad?: string };
  source?: string;
}

// Duruşma planı cihazda saklanır — hiçbir sunucu kurulumu (SQL) gerektirmez.
// React Query önbelleği de kalıcı olduğundan çevrimdışı da erişilir.
const keyFor = (caseId: string) => `VEKIL_WARPLAN_${caseId}`;

// Bu oturumda silinen davalar: planları bir daha YAZILMAZ. Plan sekmesi
// kapanırken bekleyen otomatik kayıt, silinmiş davanın planını cihazda geri
// yaratmasın.
const silinenPlanlar = new Set<string>();

/**
 * Planı cihaza yazar; sorgu önbelleğini YAZMADAN ÖNCE günceller.
 *
 * Neden önce önbellek: plan sekmesi kapanırken bekleyen kayıt yazılır
 * (otomatik kayıt, WarPlanTab). Önbellek yalnız "bayat" işaretlenseydi sekmeye
 * geri dönüldüğünde ESKİ içerik yüklenir, ilk değişiklikte de son notun
 * üstüne yazılırdı. Yazma düşerse önbellek cihazdakiyle yeniden eşitlenir ve
 * hata çağırana iletilir (kullanıcıya söylenir).
 */
export async function planiKaydet(queryClient: QueryClient, caseId: string, content: WarPlanContent): Promise<void> {
  if (silinenPlanlar.has(caseId)) return;
  queryClient.setQueryData(['brief', caseId], { content });
  try {
    await AsyncStorage.setItem(keyFor(caseId), JSON.stringify(content));
  } catch (hata) {
    queryClient.invalidateQueries({ queryKey: ['brief', caseId] });
    throw hata;
  }
}

/** Dava silinince planı cihazdan siler (bkz. lib/silinenDava). */
export async function planiSil(caseId: string): Promise<void> {
  silinenPlanlar.add(caseId);
  await AsyncStorage.removeItem(keyFor(caseId));
}

export function useBrief(caseId: string | undefined) {
  return useQuery({
    queryKey: ['brief', caseId],
    enabled: !!caseId,
    queryFn: async () => {
      // OKUMA hatası "kayıtlı plan yok" (null) sayılmaz: plan sekmesi artık
      // değişiklikleri kendiliğinden yazıyor; okunamayan planın üstüne boş
      // planla yazılmasın. Bozuk (ayrıştırılamayan) kayıt ise yok sayılır.
      const raw = await AsyncStorage.getItem(keyFor(caseId!));
      if (!raw) return null;
      try {
        return { content: JSON.parse(raw) as WarPlanContent };
      } catch {
        return null;
      }
    },
  });
}

export function useSaveBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, content }: { caseId: string; content: WarPlanContent }) =>
      planiKaydet(queryClient, caseId, content),
  });
}
