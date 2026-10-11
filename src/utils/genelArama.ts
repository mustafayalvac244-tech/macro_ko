/**
 * Genel arama (app/search.tsx) üç ayrı sorgu çalıştırır: dava, müvekkil, belge.
 *
 * KUSUR (23. denetim ajanı, 10.10.2026): sonuçlar `data ?? []` ile birleştiriliyor,
 * `error` HİÇ bakılmıyordu. Ağ kesildiğinde ya da bir sorgu (RLS, zaman aşımı)
 * hata verdiğinde ekran "Sonuç bulunamadı. Farklı bir kelime deneyin." diyordu —
 * avukat "bu müvekkil kayıtlı değil" diye düşünebilirdi. Hata ile "sonuç yok"
 * ayrı durumlar olmalı.
 *
 * Tek bir sorgunun hatası bile aramayı HATA sayar: kalan ikisinin sonucunu
 * gösterip üçüncüyü sessizce atlamak, "yok" demenin ta kendisidir.
 */
export interface SorguYaniti<T> {
  data: T[] | null;
  error: unknown;
}

export function sonuclariBirlestir<A, B, C>(
  cases: SorguYaniti<A>,
  clients: SorguYaniti<B>,
  documents: SorguYaniti<C>
): { cases: A[]; clients: B[]; documents: C[] } {
  const hata = cases.error ?? clients.error ?? documents.error;
  if (hata) throw hata;
  return {
    cases: cases.data ?? [],
    clients: clients.data ?? [],
    documents: documents.data ?? [],
  };
}
