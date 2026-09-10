// BESLEMEYİ SAĞLAYICININ TAVANINA SIĞDIR — saf mantık, testli.
// ---------------------------------------------------------------------------
// ÖLÇÜLEN ARIZA. Groq'un ücretsiz anahtarında DAKİKALIK token tavanı 8.000 ve
// sağlayıcı bunu "istek boyu" olarak hesaplıyor: girdi + istenen çıktı tavanı.
// Dilekçe isteğimiz 5.003 girdi + 3.000 çıktı = 8.003 çıktı ve HTTP 413 aldık:
//
//   "Request too large ... on tokens per minute (TPM): Limit 8000,
//    Requested 8003, please reduce your message size"
//
// ÜÇ TOKEN. Sağlık ucuyla tek tek sorduk: bu anahtardaki BÜTÜN modellerin
// dakikalık tavanı 8.000 — yani "başka modele geç" bu sorunu çözmüyor, yalnız
// günlük kotayı çözüyor. Çözüm, isteği tavana sığdırmak.
//
// NEYİ KIRPIYORUZ. Besleme dosyası şu sırayla kuruluyor: KURALLAR → MEVZUAT
// MADDELERİ → İÇTİHAT. Kırpma SONDAN yapılır, çünkü öncelik sırası tam da bu:
//   • Kurallar, ölçümle kazanılmış düzeltmelerin yaşadığı yer (def'i lafzı,
//     itirazın mercii). Kırpılırsa bugün düzelttiğimiz hatalar geri gelir.
//   • Madde metinleri, dilekçenin dayanacağı lafız.
//   • İçtihat, destekleyici. Yokluğunda dilekçe zayıflar ama YANLIŞ olmaz.
// Yani sığmayan istekte kaybedilen şey en az kritik olan.
//
// KESME NOKTASI BÖLÜM SINIRINDA. Cümlenin ortasından kesmek, modele yarım bir
// madde metni verir; yarım madde, hiç madde olmamasından tehlikelidir çünkü
// model onu tam sanıp dilekçeye alıntılar.

/**
 * Karakterden token'a kaba çeviri.
 *
 * Türkçe metinde token başına ~3 karakter düşüyor (ölçülen isteklerde
 * 8.200 karakterlik besleme ~2.400 token). Kasıtlı olarak KÖTÜMSER: fazla
 * tahmin edip gereksiz kırpmak, az tahmin edip 413 almaktan iyidir — biri
 * cevabı zayıflatır, öteki cevabı yok eder.
 */
export function tokenTahmin(metin: string): number {
  return Math.ceil(String(metin ?? '').length / 3);
}

export interface KirpmaSonuc {
  besleme: string;
  kirpildi: boolean;
  /** Kırpma sonrası tahmini toplam istek boyu (girdi + çıktı tavanı). */
  tahminiBoy: number;
}

/**
 * Besleme dosyasını, istek sağlayıcının tavanına sığacak şekilde kısaltır.
 *
 * @param besleme     kural + mevzuat + içtihat blokları
 * @param sabitMetin  sistem talimatı, tür tarifi, kullanıcının sorusu
 * @param maxCikti    modelden istenen çıktı tavanı (tavana DAHİL)
 * @param tavan       sağlayıcının dakikalık token tavanı
 * @param pay         güvenlik payı; tahmin şaşarsa 413 almayalım
 */
export function beslemeyiKirp(
  besleme: string,
  sabitMetin: string,
  maxCikti: number,
  tavan = 8000,
  pay = 400
): KirpmaSonuc {
  const sabit = tokenTahmin(sabitMetin);
  const yer = tavan - pay - maxCikti - sabit;
  const mevcut = tokenTahmin(besleme);
  if (yer <= 0) {
    // Besleme olmadan da sığmıyorsa kırpacak bir şey yok; çağıran çıktı
    // tavanını düşürmeli. Beslemeyi tamamen atmak, cevabı dayanaksız bırakır.
    return { besleme: '', kirpildi: mevcut > 0, tahminiBoy: sabit + maxCikti };
  }
  if (mevcut <= yer) {
    return { besleme, kirpildi: false, tahminiBoy: sabit + mevcut + maxCikti };
  }

  // Sondan kırp, bölüm sınırında kes.
  const hedefKarakter = yer * 3;
  let kesik = besleme.slice(0, hedefKarakter);
  const sinir = Math.max(
    kesik.lastIndexOf('\n\n###'),
    kesik.lastIndexOf('\n\n══'),
    kesik.lastIndexOf('\n\n•'),
    kesik.lastIndexOf('\n\n')
  );
  // Sınır çok başta kalıyorsa (besleme tek bir dev blok) ham kesim kalır;
  // yine de bölüm başlığı arayıp yarım madde vermemeye çalışıyoruz.
  if (sinir > hedefKarakter * 0.35) kesik = kesik.slice(0, sinir);
  return {
    besleme: kesik.trimEnd(),
    kirpildi: true,
    tahminiBoy: sabit + tokenTahmin(kesik) + maxCikti,
  };
}

/**
 * Beslenen kuralların BAŞLIKLARINI çıkarır.
 *
 * NEDEN. Ölçümde üç kez aynı şey oldu: kural beslemeye BİRİNCİ sırada girdi,
 * mütalaada tek kelime geçmedi (arabuluculuk dava şartı, iki haklı ihtar,
 * uzamış ceza zamanaşımı). Avukat için sonuç bilginin hiç olmamasıyla aynı.
 *
 * Kural bloğu istemin ORTASINDA kalıyor; modeller istemin sonuna daha çok
 * dikkat eder. Başlıkları çıkarıp sona kısa bir kontrol listesi olarak koymak,
 * beslemeyi büyütmeden aynı bilgiyi görünür kılar — birkaç yüz karakter
 * karşılığında.
 *
 * Kural metinleri "• " ile başlar ve ilk satırları başlıktır
 * ("İKİ HAKLI İHTAR NEDENİYLE TAHLİYE (TBK m.352/2) — ...").
 */
export function kuralBasliklari(besleme: string, enCok = 6): string[] {
  const out: string[] = [];
  for (const parca of String(besleme ?? '').split('\n• ').slice(1)) {
    const ilk = parca.split('\n')[0].trim();
    if (!ilk) continue;
    // Başlık, ilk tire/iki nokta öncesi: gövdenin tamamını tekrarlamak
    // listeyi beslemenin kendisi kadar uzatır ve kazancı yok eder.
    const baslik = ilk.split(/\s[—:]\s/)[0].trim();
    if (baslik.length > 4) out.push(baslik.slice(0, 120));
    if (out.length >= enCok) break;
  }
  return out;
}
