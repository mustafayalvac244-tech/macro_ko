/**
 * Uygulama içi arama için metin normalleştirme — react-native'e BAĞIMSIZ.
 *
 * NEDEN GEREKLİ. Türkçe'de `toLowerCase()` sessizce yanlış sonuç verir:
 * "İcra".toLowerCase() → "i̇cra" (i + birleşik nokta, U+0069 U+0307), yani
 * kullanıcı "icra" yazdığında EŞLEŞMEZ. Bir hukuk uygulamasında "İcra",
 * "Şikayet", "Ödeme" gibi kelimeler en sık aranan şeylerdir.
 *
 * `toLocaleLowerCase('tr')` bu yönü düzeltir ama ters yönde kırılır: Türkçe
 * kurallarına göre "I" → "ı" (noktasız) olur, dolayısıyla klavyesinde Türkçe
 * karakter olmayan biri "Icra" yazdığında yine eşleşmez.
 *
 * ÇÖZÜM: aramada iki yönü de affet. Hem İ/I/ı/i ailesini tek harfe indir, hem
 * de ş/ç/ğ/ö/ü'yü ASCII karşılığına katla. Böylece "şikayet", "Şikayet",
 * "sikayet" ve "SIKAYET" aynı sonucu bulur — Türkiye'de klavye alışkanlığı
 * düşünüldüğünde bu, doğruluk kaybı değil kullanılabilirlik kazancıdır.
 *
 * DİKKAT: bu yalnız ARAMA/EŞLEŞTİRME içindir. Görüntülenecek ya da saklanacak
 * metni asla bundan geçirmeyin; harfleri bilerek bozuyor.
 */

const KATLAMA: Record<string, string> = {
  İ: 'i', I: 'i', ı: 'i', i: 'i',
  Ş: 's', ş: 's',
  Ç: 'c', ç: 'c',
  Ğ: 'g', ğ: 'g',
  Ö: 'o', ö: 'o',
  Ü: 'u', ü: 'u',
};

/** Aramada karşılaştırılacak biçime indirger. */
export function aramaNormalize(v: string | null | undefined): string {
  const s = (v ?? '').normalize('NFC');
  let out = '';
  for (const ch of s) {
    out += KATLAMA[ch] ?? ch.toLowerCase();
  }
  // Birleşik nokta (U+0307) NFC sonrası hâlâ kalabilir; aramada gürültüdür.
  return out.replace(/̇/g, '').replace(/\s+/g, ' ').trim();
}

/** `metin`, `sorgu`yu içeriyor mu — Türkçe'ye ve klavyeye toleranslı. */
export function aramaEslesir(metin: string | null | undefined, sorgu: string | null | undefined): boolean {
  const q = aramaNormalize(sorgu);
  if (!q) return true; // boş sorgu her şeyi geçirir
  return aramaNormalize(metin).includes(q);
}
