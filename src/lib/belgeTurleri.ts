/**
 * DOSYA SEÇİCİ TÜRLERİ — TEK YERDEN.
 *
 * BULUNAN KUSUR (04.10.2026, avukat geri bildirimi: "UDF'de yüklemede sıkıntı
 * var, sözleşme eklemede yok"). Dört ekran seçiciye kendi tür listesini
 * yazıyordu ve hiçbirinde `.udf` yoktu:
 *
 *   • Belgeler kasası yalnız PDF/Word/görsel istiyordu, '*\/*' de yoktu.
 *     iPhone'da UDF dosyası seçicide GRİ görünür, seçilemez. Kasada bugüne
 *     kadar tek bir UDF yok (ölçüldü: 3 belge, 2 PDF + 1 JPEG).
 *   • Belge inceleme ve "belgeden dosya aç" listeye '*\/*' koyarak UDF'yi
 *     telefonda kurtarıyordu, ama WEB'DE KURTARMIYORDU: tarayıcı `accept`
 *     listesindeki MIME türlerini uzantıya çevirip pencereye süzgeç koyar.
 *     '*\/*' geçerli bir `accept` değeri değildir; UDF'nin MIME türü de yok.
 *     Sonuç: Windows'taki dosya penceresi "Özel dosyalar (*.pdf;*.docx…)"
 *     süzgeciyle açılır, UDF klasörde DURDUĞU HÂLDE görünmez. Avukat ancak
 *     süzgeci "Tüm dosyalar"a çevirirse bulur. (Chromium'un dönüşüm kodu:
 *     chrome/browser/file_select_helper.cc, GetFileTypesFromAcceptType.)
 *
 * DOĞRUSU: web'de UZANTI vermek (`.udf`). HTML standardı `accept` için
 * ".uzantı" biçimini tanır ve süzgece doğrudan girer. Telefonda uzantı
 * geçersiz bir MIME türü olur (iOS onu sessizce atar), orada '*\/*' gerekir.
 *
 * Saf modül (react-native çekmez) — tests/belgeTurleri.test.ts sınıyor.
 */

/** Metni okunabilen belge türlerinin MIME karşılıkları. UDF'nin MIME'i yok. */
export const BELGE_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'application/rtf',
  'text/rtf',
] as const;

/** Aynı türlerin uzantıları — web süzgecine bunlar girer. */
export const BELGE_UZANTI = ['.pdf', '.udf', '.docx', '.doc', '.txt', '.rtf'] as const;

/**
 * Metni okunacak belge için seçici türleri: belge inceleme, dilekçe eki,
 * belgeden dosya açma.
 */
export function belgeSeciciTurleri(platform: string): string[] {
  if (platform === 'web') return [...BELGE_UZANTI, ...BELGE_MIME];
  return [...BELGE_MIME, '*/*'];
}

/** Belgeler kasasına yükleme: belgeler + fotoğraf/görsel. */
export function kasaSeciciTurleri(platform: string): string[] {
  if (platform === 'web') return [...BELGE_UZANTI, ...BELGE_MIME, 'image/*'];
  return [...BELGE_MIME, 'image/*', '*/*'];
}

/** UDF mi? Ad üzerinden: UDF'nin kayıtlı bir MIME türü yok. */
export function udfMi(ad: string | null | undefined): boolean {
  return /\.udf$/i.test(ad ?? '');
}

/**
 * Depoya yazılacak içerik türü.
 *
 * Tarayıcı tanımadığı türe BOŞ DİZE verir (UDF böyle gelir). Boş dize
 * `?? 'application/octet-stream'` yedeğini atlatır — `??` yalnız null/undefined
 * yakalar — ve depoya içerik türü boş bir dosya gider.
 */
export function icerikTuru(ad: string, mime: string | null | undefined): string {
  const m = (mime ?? '').trim();
  if (m) return m;
  const n = ad.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (n.endsWith('.doc')) return 'application/msword';
  if (n.endsWith('.txt')) return 'text/plain';
  if (n.endsWith('.rtf')) return 'application/rtf';
  return 'application/octet-stream';
}
