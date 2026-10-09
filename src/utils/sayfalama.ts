/**
 * TÜM SATIRLARI SAYFA SAYFA GETİRME — PostgREST satır tavanına karşı.
 *
 * NEDEN (09.10.2026 denetimi). Supabase Data API (PostgREST) tek yanıtta en çok
 * `max_rows` satır döndürür; Supabase'in belgelenmiş varsayılanı 1000'dir
 * (supabase.com/docs/guides/local-development/cli/config → `api.max_rows`).
 * Barındırılan projede bu değer panelden değişir; bizim projedeki değer
 * veritabanından okunamıyor (authenticator rolünde `pgrst.db_max_rows` yok).
 * Tavanı aşan sorgu HATA VERMEZ, sessizce kısa döner. Dava dizini tek sorguyla
 * çekiliyordu: 1000'i aşan avukatın en eski dosyaları listeden — ve artık
 * cihazda yapılan aramadan — sessizce düşerdi.
 *
 * NASIL. Çağıran her sayfayı `count: 'exact'` ile ister. Toplam bilindiği için
 * sunucunun tavanı sayfa boyundan KÜÇÜK olsa bile eksik kalmaz: sonraki sayfa,
 * gelen satır sayısı kadar ileriden istenir. Toplam bilinmiyorsa kısa sayfa
 * son sayfa sayılır. Küçük listede tek istek atılır (boş sayfa yoklanmaz).
 * Sorgu, sayfalar arasında kaymasın diye benzersiz bir sırayla (sonda `id`)
 * kurulmalıdır.
 */
export const SAYFA_BOYU = 1000;

export interface SayfaSonucu<T> {
  data: T[] | null;
  error: unknown;
  count?: number | null;
}

export async function tumSayfalar<T>(
  sayfaGetir: (bas: number, son: number) => PromiseLike<SayfaSonucu<T>>,
  sayfaBoyu: number = SAYFA_BOYU,
): Promise<T[]> {
  const hepsi: T[] = [];
  for (;;) {
    const bas = hepsi.length;
    const { data, error, count } = await sayfaGetir(bas, bas + sayfaBoyu - 1);
    if (error) throw error;
    const sayfa = data ?? [];
    for (const satir of sayfa) hepsi.push(satir);
    if (sayfa.length === 0) return hepsi;
    const bitti = typeof count === 'number' ? hepsi.length >= count : sayfa.length < sayfaBoyu;
    if (bitti) return hepsi;
  }
}
