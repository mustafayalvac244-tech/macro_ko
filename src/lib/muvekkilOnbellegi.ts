import type { Query, QueryClient } from '@tanstack/react-query';

/**
 * MÜVEKKİL DEĞİŞİNCE / SİLİNİNCE HANGİ ÖNBELLEKLER BAYATLAR (10.10.2026).
 *
 * Eskiden yalnız ['clients'] tazeleniyordu. Müvekkil adı başka ekranların
 * sorgularında kopya olarak taşınıyor: dava ve icra listeleri
 * (`client:clients(id, full_name, company)`), alacak/taksit listesi ve
 * vekaletname listesi (`client:clients(id, full_name)`), arama sonuçları.
 * Ad düzenlenince ya da müvekkil silinince bunlar eski adı göstermeye devam
 * ediyordu.
 *
 * Müvekkil silinince şemadan (tests/muvekkilSilme.test.ts): alacak, avans ve
 * elle masraf SATIRLARI gider (cascade); dava, belge, icra, vekaletname
 * bağlantısı boşalır (set null). Bu satırları sayan toplamlar (avans bakiyesi,
 * ana ekran uyarıları ve sayaçları) da tazelenmelidir.
 */

/** Adı ya da bağlantısı müvekkilden gelen listelerin ortak kökleri. */
const MUVEKKIL_ADI_TASIYANLAR = ['clients', 'cases', 'enforcements', 'promises', 'poa', 'global-search'];

/** Düzenleme sonrası (useUpdateClient). */
export function muvekkilDegisinceTazele(queryClient: QueryClient): void {
  for (const k of MUVEKKIL_ADI_TASIYANLAR) queryClient.invalidateQueries({ queryKey: [k] });
}

/** Sorgu anahtarı bu müvekkile mi ait (['clients','detail',id], ['client-advances',id] …). */
const muvekkilinMi = (clientId: string) => (q: Query) => q.queryKey.includes(clientId);

/** Silme SUNUCUDA başarılı olduktan sonra çağrılır (bkz. useDeleteClient). */
export function silinenMuvekkilOnbelleginiTazele(queryClient: QueryClient, clientId: string): void {
  const buMuvekkilin = muvekkilinMi(clientId);

  // Silinen müvekkilin kendi sorguları: yeniden ÇEKİLMEZ, yalnız bayat işaretlenir.
  // Açık detay ekranı geri dönerken "bulunamadı"ya zıplamasın; ama biri bu
  // kaydı yeniden açarsa (web'de ileri tuşu, eski bağlantı) sunucuya sorulsun.
  queryClient.invalidateQueries({ predicate: buMuvekkilin, refetchType: 'none' });

  for (const k of [
    ...MUVEKKIL_ADI_TASIYANLAR,
    'documents',
    'client-expenses-total',
    'advance-deficits',
    'dashboard-stats',
  ]) {
    queryClient.invalidateQueries({ queryKey: [k], predicate: (q) => !buMuvekkilin(q) });
  }
}
