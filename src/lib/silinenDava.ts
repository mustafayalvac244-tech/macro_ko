import type { Query, QueryClient } from '@tanstack/react-query';
import { planiSil } from '@/hooks/useBriefs';
import { useSayacStore } from '@/store/sayacStore';

/**
 * DAVA SİLİNDİKTEN SONRA CİHAZDA VE ÖNBELLEKTE KALANLAR (09.10.2026).
 *
 * 08.10'da cascade ile giden duruşma/görevlerin yerel hatırlatmaları iptal
 * edildi ve listeler tazelendi (useDeleteCase). Denetimde üç artık daha
 * bulundu, kodla doğrulandı:
 *
 *  1. ÇALIŞAN SAYAÇ durmuyordu. Sayaç yalnız kendi davasının Zaman sekmesinden
 *     durdurulabiliyor; dava gidince o sekme de gidiyor. Sonuç: öbür bütün
 *     davalarda "Başka bir dosyada sayaç çalışıyor: <silinen dava>" ve kapalı
 *     Başlat düğmesi — çıkış yapana kadar (çıkıştaki temizlik 08.10'da var,
 *     authStore). Silinen davanın kayıtları da gittiği için geçen süre
 *     yazılacak bir dosya yok; sayaç iptal edilir.
 *  2. DURUŞMA PLANI (brief, duruşma notları, değerlendirme) cihazda
 *     VEKIL_WARPLAN_<id> anahtarında kalıyordu. Onay metni "bağlı her şey
 *     silinir" diyor; plan cihaza yazıldığı için sunucu cascade'i onu görmez.
 *     YALNIZ BU CİHAZDAKİ kopya silinir — plan başka bir cihazda açılıp
 *     kaydedildiyse o cihazda kalır (plan sunucuda tutulmuyor).
 *  3. ÖNBELLEK: arama sonuçları silinen davayı göstermeye devam ediyordu
 *     (dokununca hayalet dosya); müvekkilin avans bakiyesi ve ana ekrandaki
 *     "avans eksiye düştü" uyarısı cascade ile giden masrafları saymaya devam
 *     ediyordu. Silinen davanın KENDİ sorguları ise (detay, ödemeler…)
 *     boşuna yeniden çekiliyordu: kayıt yok, istek boşa gider.
 */

/** Sorgu anahtarı bu davaya mı ait (['cases','detail',id], ['payments','byCase',id] …). */
const davaninMi = (caseId: string) => (q: Query) => q.queryKey.includes(caseId);

/** Silme SUNUCUDA başarılı olduktan sonra çağrılır (bkz. useDeleteCase). */
export async function silinenDavaninYerelArtiklariniSil(caseId: string): Promise<void> {
  const sayac = useSayacStore.getState();
  if (sayac.startedAt != null && sayac.caseId === caseId) sayac.iptal();
  await planiSil(caseId);
}

/** Silinen davaya ait ve onu içeren önbellekleri düzenler (onSuccess'te). */
export function silinenDavaOnbelleginiTazele(queryClient: QueryClient, caseId: string): void {
  const buDavanin = davaninMi(caseId);

  // Silinen davanın kendi sorguları: yeniden ÇEKİLMEZ, yalnız bayat işaretlenir.
  // Açık ekran kapanırken boş listelere/"bulunamadı"ya dönmesin; ama biri bu
  // dosyayı yeniden açarsa (web'de ileri tuşu, eski bağlantı) sunucuya
  // sorulsun ve "Dava bulunamadı" görünsün (bkz. utils/davaEkrani).
  queryClient.invalidateQueries({ predicate: buDavanin, refetchType: 'none' });
  queryClient.removeQueries({ queryKey: ['brief', caseId] });

  // Cascade ile giden kayıtları listeleyen her şey + dava adını taşıyan arama
  // sonuçları + silinen masrafları sayan müvekkil avans bakiyesi ve ana ekran
  // avans uyarısı.
  for (const k of [
    'cases',
    'documents',
    'hearings',
    'deadlines',
    'payments',
    'case-expenses',
    'installments',
    'time-entries',
    'global-search',
    'client-expenses-total',
    'advance-deficits',
  ]) {
    queryClient.invalidateQueries({ queryKey: [k], predicate: (q) => !buDavanin(q) });
  }
}
