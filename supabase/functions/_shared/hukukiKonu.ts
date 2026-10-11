// CANLI İÇTİHAT ARAMASINA ANLATIM DEĞİL, SABİT HUKUKİ KONU GİDER (09.10.2026).
// ---------------------------------------------------------------------------
// BULUNAN SIZINTI. Dilekçe yolunda havuz yetersiz kalınca avukatın OLAY
// ANLATIMI (müvekkilin adı, T.C. numarası, adresi, olayın kendisi + eklerin
// ilk 1.200 karakteri) olduğu gibi Bedesten'e (bedesten.adalet.gov.tr)
// `phrase` olarak gidiyordu; aynı metnin ilk 120 karakteri de
// ictihat_kararlar.arama_terimi'ne yazılmak üzere arşivleyiciye veriliyordu.
// Bu, 0162'nin ilkesine ("soru metni saklanmaz; yalnız SABİT konu adlarıyla
// eşleştirilir") ve müvekkil sırrına aykırıydı.
//
// ŞİMDİ: anlatım yalnız BELLEKTE, hasat konu listesiyle (ictihat_harvest_state,
// ön eksiz terimler) eşleştirilir; dışarı yalnız listedeki konunun kendisi
// gider. Eşleşme yoksa canlı arama YAPILMAZ — anlatım hiçbir koşulda gitmez.
// Eşleştirme kuralı 0162'deki hasat_talep_kaydet ile aynıdır: Türkçe küçük
// harf (tr_kucult), sondaki "dava/davası/davaları" atılır (çekirdek), çekirdek
// en az 4 harf ve anlatımda geçmeli.
//
// Bedeli bilinçli: listede karşılığı olmayan bir olayda dosyaya canlı kaynaktan
// karar girmez, havuzdakilerle yetinilir. Kendi 11 dilekçe senaryomuzun 7'sinde
// konu eşleşti (09.10 yerel deneme, scripts/ictihat-terms.txt ile; gerçek
// kullanımda oran ÖLÇÜLMEDİ).
//
// Saf modül: Deno'ya özgü hiçbir şey yok (tests/dilekceSunucu.test.ts).

const TR_BUYUK: Record<string, string> = {
  'İ': 'i', 'I': 'ı', 'Ş': 'ş', 'Ğ': 'ğ', 'Ü': 'ü', 'Ö': 'ö', 'Ç': 'ç', 'Â': 'a', 'Î': 'i', 'Û': 'u',
};

/** SQL'deki public.tr_kucult ile aynı: translate('İIŞĞÜÖÇÂÎÛ' → 'iışğüöçaiu') + lower. */
export function trKucult(s: string): string {
  return String(s ?? '').replace(/[İIŞĞÜÖÇÂÎÛ]/g, (c) => TR_BUYUK[c] ?? c).toLowerCase();
}

/** SQL'deki public.hasat_terim_cekirdek ile aynı. */
export function konuCekirdegi(terim: string): string {
  return trKucult(String(terim ?? '').trim()).replace(/\s+(dava|davası|davasi|davaları|davalari)$/, '').trim();
}

/**
 * Anlatımda geçen en belirgin (çekirdeği en uzun) hasat konusu; yoksa null.
 * Dönen değer HER ZAMAN `konular` listesinin bir elemanıdır, anlatımdan
 * hiçbir parça değil.
 */
export function hukukiKonuSec(metin: string, konular: readonly string[]): string | null {
  const m = trKucult(String(metin ?? ''));
  if (!m.trim()) return null;
  let secilen: string | null = null;
  let uzunluk = 0;
  for (const t of konular) {
    // "yargitay:…" / "danistay:…" kaynak önekli kopyalardır (0162 gibi atlanır).
    if (!t || t.includes(':')) continue;
    const c = konuCekirdegi(t);
    if (c.length < 4 || !m.includes(c)) continue;
    if (c.length > uzunluk) {
      secilen = t.trim();
      uzunluk = c.length;
    }
  }
  return secilen;
}
