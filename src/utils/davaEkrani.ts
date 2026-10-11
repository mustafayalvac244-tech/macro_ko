/**
 * DOSYA DETAYI HANGİ DURUMDA? (09.10.2026, 50 denetçi taraması, kodla doğrulandı)
 *
 * BULUNAN KUSUR. Ekran `isLoading || !caseItem` ise yalnız başlık çiziyordu:
 * "yükleniyor", "böyle bir dosya yok" ve "bağlantı hatası" üçü de AYNI boş
 * sayfaydı ve hiçbiri bitmiyordu. Silinmiş bir dosyanın bağlantısı (web yer
 * imi ya da geri/ileri, başka cihazda silinen dosya, eski arama sonucu)
 * kullanıcıyı açıklamasız boş sayfada bırakıyordu. Önbellekte eski kopyası
 * varsa daha kötüsü: silinmiş dosya varmış gibi açılıyor, yapılan her
 * değişiklik "kaydedilemedi" alıyordu.
 *
 * KARAR KURALLARI
 *  - Sunucu "satır yok" dedi (maybeSingle → null): silinmiş ya da bu hesabın
 *    değil (RLS). Önbellekteki eski kopya da bu cevapla null'a döner, yani
 *    hayalet dosya gösterilmez.
 *  - Elde kopya VARKEN arka plandaki yenileme düşerse ekran açık kalır: kalıcı
 *    önbellek tam da adliyede çekmeyen yerde dosyayı görebilmek için var.
 *  - Kopya yokken hata: "yüklenemedi" + tekrar dene. Bozuk kimlik (uuid değil)
 *    bir bağlantı hatası değil, dosya yok demektir.
 *
 * Saf mantık; ekran (app/(app)/cases/[id].tsx) yalnız sonucu çizer.
 */
export type DavaEkranDurumu = 'yukleniyor' | 'bulunamadi' | 'yuklenemedi' | 'hazir';

/** Postgres 22P02: kimlik uuid biçiminde değil — tekrar denemek işe yaramaz. */
export function gecersizKimlikMi(hata: unknown): boolean {
  return (hata as { code?: unknown } | null)?.code === '22P02';
}

export function davaEkranDurumu(s: { kimlik?: string | null; veri: unknown; hata: unknown }): DavaEkranDurumu {
  if (!s.kimlik) return 'bulunamadi';
  if (s.veri) return 'hazir';
  if (s.veri === null) return 'bulunamadi';
  if (s.hata) return gecersizKimlikMi(s.hata) ? 'bulunamadi' : 'yuklenemedi';
  return 'yukleniyor';
}
