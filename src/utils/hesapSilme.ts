// HESAP SİLMEDE DEPODAKİ DOSYALAR — saf mantık (bkz. authStore.deleteAccount).
// authStore react-native/expo içe aktardığı için vitest onu yükleyemez;
// Supabase çağrıları buraya dışarıdan verilir, burada yalnız karar var.
//
// İKİ YARDIMCI DA HATADA FIRLATIR; çağıran taraf o zaman hesabı SİLMEZ ve
// kullanıcı "Hesap silinemedi, tekrar deneyin" görür. Eskisi (09.10.2026'ya
// kadar) hataları yutuyordu: dosyalar depoda kalırken hesap siliniyor ve
// ekran "dosyalarınız kalıcı olarak silinir" diyordu. Hesap silindikten sonra
// belge satırları da gittiği için o dosyaların yolu bir daha bulunamazdı.
// Belge silmede aynı kural 08.10.2026'dan beri geçerli (useDeleteDocument).

/** supabase-js sorgu dönüşünün bize gereken kısmı. */
export interface SorguSonucu<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Kullanıcının belge satırlarındaki dosya yollarını EKSİKSİZ toplar.
 *
 * SAYFALAMA: PostgREST tek yanıtta en çok `max_rows` satır verir (Supabase
 * varsayılanı 1000; bu projede değiştirilip değiştirilmediği ÖLÇÜLMEDİ).
 * Tek sorgu, belgesi bundan fazla olan avukatın kalan dosyalarını sessizce
 * dışarıda bırakırdı. BOŞ SAYFA gelene kadar okunur: "sayfa boyundan az
 * geldi, bitti" kuralı, sunucu tavanı bizim sayfa boyumuzdan küçükse ilk
 * sayfada yanlışlıkla dururdu. Bedeli tek bir fazladan istek.
 *
 * Çağıran, sayfaların kaymaması için benzersiz bir sütuna göre sıralamalı.
 */
export async function belgeYollari(
  sayfaGetir: (bas: number, son: number) => PromiseLike<SorguSonucu<{ file_path: string | null }>>,
  sayfaBoyu = 1000,
): Promise<string[]> {
  const yollar: string[] = [];
  let bas = 0;
  for (;;) {
    const { data, error } = await sayfaGetir(bas, bas + sayfaBoyu - 1);
    // Okunamayan liste "belge yok" DEĞİLDİR (bkz. once-dusun §6).
    if (error) throw error;
    const satirlar = data ?? [];
    if (satirlar.length === 0) break;
    for (const s of satirlar) if (s.file_path) yollar.push(s.file_path);
    bas += satirlar.length;
  }
  return yollar;
}

/**
 * Yolları depodan siler; bir parça hata dönerse FIRLATIR ve sonrakileri
 * denemez.
 *
 * storage-js hatayı fırlatmaz, `{ error }` döndürür (storage-js 2.110.0,
 * dist/index.mjs > handleOperation): ağ ve sunucu hataları da böyle döner.
 * Bu yüzden dönen `error` okunur; `.catch` burada hiçbir şey yakalamaz.
 *
 * PARÇALAMA (100'erli) önceki koddan aynen: çok sayıda yolu tek istekte
 * göndermek isteğin tümden reddine yol açabilir. Depoda olmayan bir yol
 * hata sayılmaz, yalnız silinenler listesine girmez (supabase/storage
 * kaynağı, src/storage/object.ts > deleteObjects, master dalı 09.10.2026'da
 * okundu); bu yüzden yarıda kalmış bir silmeyi tekrar denemek güvenlidir.
 */
export async function depodanSil(
  sil: (yollar: string[]) => PromiseLike<{ error: unknown }>,
  yollar: string[],
  parca = 100,
): Promise<void> {
  for (let i = 0; i < yollar.length; i += parca) {
    const { error } = await sil(yollar.slice(i, i + parca));
    if (error) throw error;
  }
}
