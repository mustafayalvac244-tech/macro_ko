/**
 * MAKİNE-OKUNUR HATA KODLARI — üreten ve çözen taraf tek dosyada.
 *
 * NEDEN. Bu uygulamada bazı hatalar ARIZA DEĞİL, kuraldır: plan limiti dolmuş
 * olabilir, dosya kovanın sınırını aşmış olabilir. Bunlara "İşlem
 * tamamlanamadı, lütfen tekrar deneyin" demek yanıltıcıdır — tekrar denemek
 * hiçbir zaman işe yaramaz. Bu yüzden hata mesajları serbest metin değil,
 * ayrıştırılabilir bir desen taşıyor (plan limitinde 'plan_limiti:<tür>:<limit>',
 * burada 'dosya_buyuk:<mb>').
 *
 * Desen ÜRETEN yer (useDocuments) ile ÇÖZEN yer (saveError) ayrı dosyalardı ve
 * desen iki yerde elle yazılıydı. Biri değişip diğeri kalsaydı hiçbir hata
 * çıkmaz, yalnızca kullanıcı yanlış cümleyi görürdü — sessizce. Desenin tek
 * sahibi burasıdır; ayrıca saf olduğu için davranışı teste bağlanabiliyor
 * (saveError react-native'e bağlı olduğundan test edilemiyor).
 */

const DOSYA_BUYUK_ONEK = 'dosya_buyuk';

/** Sınırı aşan dosya için hata mesajı üretir. */
export function dosyaBuyukKodu(mb: number): string {
  return `${DOSYA_BUYUK_ONEK}:${mb}`;
}

/**
 * Mesajdan dosya boyutu sınırını çözer; bu hata değilse null.
 * Sınır rakamı mesajın içinden okunur — böylece kovadaki sınır değiştiğinde
 * kullanıcıya gösterilen sayı da kendiliğinden değişir.
 */
export function dosyaBuyukCoz(mesaj: string | undefined | null): { mb: number } | null {
  const m = new RegExp(`${DOSYA_BUYUK_ONEK}:(\\d+)`).exec(mesaj ?? '');
  if (!m) return null;
  const mb = Number(m[1]);
  return Number.isFinite(mb) && mb > 0 ? { mb } : null;
}

/**
 * Sunucunun kendi "çok büyük" yanıtları. İstemci kontrolü atlanabildiği için
 * (seçici boyutu bildirmediyse) bu yol da kullanıcıya doğru cümleyi verir.
 */
export function sunucuDosyaBuyukMu(mesaj: string | undefined | null): boolean {
  const raw = (mesaj ?? '').toLowerCase();
  return raw.includes('payload too large') || raw.includes('exceeded the maximum allowed size');
}
