/**
 * CİHAZ ÖNBELLEĞİNE NE YAZILIR — saf kural (test edilebilsin diye ayrı dosya).
 *
 * Sorgu önbelleği çevrimdışı dayanıklılık için cihaza yazılıyor
 * (src/lib/queryClient.ts). Yönetici paneli sorguları (`['admin', ...]`)
 * bunun dışında tutulur: TÜM kullanıcıların e-postası, adı, büro adı ve finans
 * toplamları o sorgulardan gelir; bunları yöneticinin cihazında 24 saat şifresiz
 * bırakmak için bir sebep yok — panel çevrimdışı açılmak zorunda değil.
 * (10.10.2026 denetimi, tests/yoneticiPaneli.test.ts.)
 */
export function onbellegeYazilsinMi(queryKey: readonly unknown[]): boolean {
  return queryKey[0] !== 'admin';
}
