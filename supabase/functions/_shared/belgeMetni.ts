// BELGE METNİ AYIKLAMA — saf mantık, testli.
// ---------------------------------------------------------------------------
// NEDEN AYRI DOSYA. Buradaki tek işlev, yüklenen dosyadan avukatın göreceği
// metni çıkarıyor. Yanlış çalıştığında ekran "Dosya boş görünüyor" diyor ve
// kullanıcı, dosyasında bir sorun olduğunu sanıyor — oysa hata bizde.
// Uç işlevinin içindeyken sınanamıyordu (Deno'ya özgü şeyler var).
//
// ÖLÇÜLEN ARIZA: UYAP UDF dosyalarında metin CDATA bloğunun içinde durur
// (<content><![CDATA[ ... ]]></content>). Etiket temizleyicisi CDATA'yı da bir
// etiket sanıp KOMPLE SİLİYORDU: geriye hiçbir şey kalmıyor, uç 422 "empty"
// dönüyordu. Yani ekranın açıkça vaat ettiği UDF desteği çalışmıyordu ve bunu
// yalnız gerçek bir UDF yükleyen avukat fark ederdi.

/**
 * XML/HTML etiketlerini temizler, paragraf sonlarını korur.
 *
 * CDATA ÖNCE AÇILIR. `<[^>]+>` deseni `<![CDATA[...]]>` bloğunun tamamını tek
 * bir etiket gibi eşleştirip siliyordu; içerideki metin de onunla gidiyordu.
 */
export function stripXml(xml: string): string {
  return String(xml ?? '')
    // CDATA içindeki metin BELGENİN KENDİSİDİR; etiket temizliğinden önce açılır.
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    // paragraf/satır sonlarını koru
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/paragraph>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * UDF METNİ — content.xml'den belgenin GERÇEK metni (04.10.2026).
 *
 * NEDEN stripXml DEĞİL. UDF'de metnin tamamı tek bir <content> CDATA'sında
 * durur; biçim bilgisi ayrı <elements> bölümündedir. stripXml CDATA'yı açıp
 * SONRA etiket temizliyordu: belgenin kendi metnindeki "<" ile ">" arası
 * (ör. "<ek-1>", "a < b ve c > d") etiket sanılıp siliniyordu.
 *
 * İKİ YER TUTUCU ATILIR: U+FFFC resmin, U+200B boş paragrafın yeridir
 * (UYAP biçimi; bkz. src/lib/udf.ts). Metinde görünmez ya da "￼" kutusu
 * olarak çıkar, avukatın okuyacağı metne ait değildir.
 *
 * BÖLÜNMÜŞ CDATA. "]]>" geçen metin birden çok CDATA parçasına bölünerek
 * yazılır (bizim üreticimiz de böyle yazar); parçalar birleştirilir.
 *
 * <content> CDATA'sı bulunamazsa stripXml'e düşer: tanımadığımız bir sürüm
 * hiç okunmamaktansa kaba okunsun.
 */
export function udfMetni(xml: string): string {
  const s = String(xml ?? '');
  const govde = s.match(/<content>\s*((?:<!\[CDATA\[[\s\S]*?\]\]>\s*)+)<\/content>/);
  if (!govde) return stripXml(s);
  const metin = [...govde[1].matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1]).join('');
  return metin
    .replace(/\r\n?/g, '\n')
    .replace(/[​￼]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
