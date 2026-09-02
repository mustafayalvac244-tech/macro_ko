// Ölçüm eşleştiricisi — cevap metninde bir ölçütün geçip geçmediğine karar verir.
// ---------------------------------------------------------------------------
// AYRI MODÜL, ÇÜNKÜ TESTİ VAR: bu mantık ölçümlerde DÖRT KEZ yanıldı ve her
// seferinde DOĞRU bir cevabı yanlış saydırdı:
//   1) "tebliğinden" beklenirken model "tebliginden" yazdı (yumuşak g yok)
//   2) "30 gün" beklenirken araya bölünmez boşluk girdi
//   3) HMK m.127'de yanlış beklenti yazılmıştı (ek süre gerçek hükümdür)
//   4) "on yıl" beklenirken model "on (10) yıldır" yazdı — parantez kalıbı bozdu
// Ölçüm aracının kendisi hata kaynağı olunca, ölçüme dayanan her karar da
// şüpheli hâle geliyor. Bu yüzden burası tests/ altında sınanır.
import { readFileSync } from 'node:fs';

/**
 * Karşılaştırma için metni sadeleştirir: Türkçe aksanlar düşer, özel boşluk ve
 * tire karakterleri normale iner, çoklu boşluk teke iner.
 *
 * Aksan düşürmek bilinçli: "tebliğinden" ile "tebliginden" arasındaki fark bir
 * YAZIM farkıdır, hukuk farkı değildir.
 */
export function sadelestir(v) {
  return String(v ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[ğüşıöçâîû]/g, (c) => ({ ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' })[c])
    .replace(/[     ]/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ');
}

const TR_ASCII = {
  ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u',
  Ğ: 'G', Ü: 'U', Ş: 'S', İ: 'I', Ö: 'O', Ç: 'C', Â: 'A', Î: 'I', Û: 'U',
};

/**
 * Düzenli ifade kalıbını metinle aynı alfabeye indirger — AMA BÜYÜK/KÜÇÜK
 * HARFİ DEĞİŞTİRMEZ.
 *
 * Kritik: kalıbı küçük harfe çevirmek `\W` (kelime olmayan) ifadesini `\w`
 * (kelime) yapıp anlamını TERSİNE çeviriyordu; hiçbir kalıp eşleşmiyor ve
 * doğru cevaplar sessizce yanlış sayılıyordu. Büyük/küçük harf duyarsızlığı
 * zaten 'i' bayrağıyla sağlanıyor.
 */
function kalibiSadelestir(v) {
  return String(v ?? '')
    .replace(/[ğüşıöçâîûĞÜŞİÖÇÂÎÛ]/g, (c) => TR_ASCII[c] ?? c)
    .replace(/[     ]/g, ' ')
    .replace(/[‐‑‒–—]/g, '-');
}

/**
 * Ölçüt metinde geçiyor mu?
 *   "a|b"      → biri geçse yeterli
 *   "re:..."   → düzenli ifade (araya giren parantez/sayı gibi eklemeler için)
 */
export function gecer(metin, kalip) {
  const d = sadelestir(metin);
  const k = String(kalip ?? '');

  // 're:' varsa TAMAMI tek düzenli ifadedir — '|' üzerinden BÖLÜNMEZ, çünkü
  // orada '|' düzenli ifadenin kendi "veya"sıdır. Bölmek, ifadeyi iki yarıya
  // ayırıp ikinci yarıyı düz metin sanmaya yol açıyordu.
  if (k.startsWith('re:')) {
    try {
      return new RegExp(kalibiSadelestir(k.slice(3)), 'i').test(d);
    } catch {
      return false;
    }
  }
  return k.split('|').some((p) => d.includes(sadelestir(p)));
}

/** Soru kümesini okur (ölçüm betikleri ve testler aynı dosyayı kullansın). */
export function sorulariOku(yol) {
  return JSON.parse(readFileSync(yol, 'utf8'));
}
