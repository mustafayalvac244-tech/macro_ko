/**
 * Telefon numarası normalleştirme — react-native'e BAĞIMSIZ tutulur.
 *
 * NEDEN AYRI DOSYA. reminder.ts `Linking` çekiyor ve test koşucusu
 * react-native'i ayrıştıramıyor; bu yüzden numara mantığı hiç test
 * edilemiyordu. Yanlış normalleştirilen numara, duruşma hatırlatmasının
 * YANLIŞ KİŞİYE gitmesi ya da hiç gitmemesi demektir.
 */

/**
 * Türk telefon numarasını WhatsApp'ın beklediği uluslararası biçime çevirir
 * (ülke kodu dahil, + ve boşluklar olmadan). Örn:
 *   "0532 123 45 67"   → "905321234567"
 *   "+90 532 123 4567" → "905321234567"
 *   "532 123 4567"     → "905321234567"
 */
export function normalizePhoneForWa(raw: string): string {
  let d = (raw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  // ULUSLARARASI ARAMA ÖNEKİ "00" ÖNCE AYIKLANIR. Rehberde numarayı
  // "0090 532..." diye tutan kullanıcı vardı ve eski sıralama bunu bozuyordu:
  // "90" ile başlamadığı için (0 ile başlıyor) yalnız TEK sıfır atılıyor,
  // geriye "0905321234567" kalıyor, uzunluk 10 olmadığı için de olduğu gibi
  // WhatsApp'a veriliyordu — numara hatalı gidiyordu.
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('90')) return d; // zaten ülke kodlu
  if (d.startsWith('0')) d = d.slice(1); // baştaki 0'ı at
  if (d.length === 10) return `90${d}`; // 5xxxxxxxxx → 90 5xxxxxxxxx
  return d; // yabancı/bilinmeyen numara: olduğu gibi bırak
}
