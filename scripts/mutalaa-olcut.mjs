// Mütalaa ölçütleri — yapı ve "adımlarda süre" denetimi.
// ---------------------------------------------------------------------------
// AYRI MODÜL, ÇÜNKÜ TESTİ VAR. Bu üç ölçüt, bir mütalaanın geçip geçmediğine
// karar veriyor; yanılırsa ölçüme dayanan her karar da yanılır.
//
// İLK YAZILIŞTA ÜÇÜ BOZUKTU ve HER ZAMAN "eksik" diyordu: desenler doğrudan
// /risk/i biçiminde yazılmıştı, oysa JavaScript'in /i bayrağı Türkçe büyük İ'yi
// (U+0130) küçük i'ye EŞLEMEZ. "RİSKLER", "TESPİTLER" ve "HUKUKİ SORUNLAR"
// hiçbir zaman eşleşmiyordu; kusursuz bir mütalaa "üç bölümü eksik" görünecekti.
// Bu projede aynı Türkçe tuzağına birkaç kez düşüldü ve her seferinde DOĞRU
// çıktıyı yanlış saydırdı. Çözüm: karşılaştırma, sadeleştirilmiş (Türkçe
// küçültme + aksan düşürme) metin üzerinde ASCII desenlerle yapılır.
//
// Ölçütler `sadelestir()` çıktısı üzerinde çalışır — ham metin verilirse
// sonuç yine yanlış olur.

/** ai-chat'teki sentez talimatının istediği altı bölüm, aynı sırayla. */
export const BOLUMLER = [
  ['olay', /olay ve tespit/],
  ['sorunlar', /hukuki sorun/],
  ['inceleme', /inceleme/],
  ['riskler', /risk/],
  ['kanaat', /kanaat/],
  ['adimlar', /atilacak adim|adimlar/],
];

/** Sadeleştirilmiş mütalaa metninde eksik olan bölümlerin adları. */
export function eksikBolumler(sade) {
  return BOLUMLER.filter(([, desen]) => !desen.test(String(sade ?? ''))).map(([ad]) => ad);
}

/**
 * Süre/tarih içeriyor mu? "ATILACAK ADIMLAR" bölümü süre içermiyorsa mütalaa
 * tavsiye değil, deneme yazısıdır: avukat ne zamana kadar ne yapacağını
 * bilmeden hareket edemez.
 */
export const SURE_DESENI =
  /\b\d+\s*(gun|is gunu|hafta|ay|yil)\b|\b(bir|iki|uc|dort|bes|alti|yedi|on|otuz|altmis)\s*(gun|hafta|ay|yil)\b|\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/;

export function sureIceriyor(sade) {
  return SURE_DESENI.test(String(sade ?? ''));
}

/** "ATILACAK ADIMLAR" bölümü — sadeleştirilmiş metinde başlıktan sonrası. */
export function adimlarBolumu(sade) {
  const s = String(sade ?? '');
  const i = s.indexOf('atilacak adim');
  return i >= 0 ? s.slice(i) : '';
}
