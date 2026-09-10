/**
 * TAKSİT BÖLÜŞTÜRME — kuruş tabanlı, testli.
 *
 * BULUNAN KUSUR (ölçüldü). Taksit tutarları şöyle hesaplanıyordu:
 *
 *     per  = Math.floor((toplam / adet) * 100) / 100
 *     son  = Math.round((toplam - per * (adet - 1)) * 100) / 100
 *
 * TOPLAM her zaman doğru çıkıyor — bu yönüyle kusur yoktu. Ama `toplam / adet`
 * kayan noktada tam bölünmediğinde `floor` bir kuruş AŞAĞI kayıyor ve fark son
 * taksite yığılıyor. Yani eşit olması gereken taksitler eşit olmuyordu.
 *
 * ÖLÇÜM: 1.000–50.000 ₺ arasındaki her kuruş değeri × {2,3,4,6,12} taksit
 * (~24,5 milyon kombinasyon) tarandı; ~500 binde (yaklaşık %2) dağıtım sapıyor.
 * En kötü gözlenen durum: 1.024,08 ₺ / 12 taksit → 85,33 × 11 + 85,45 yerine
 * 85,34 × 12 olmalıydı; son taksit 12 kuruş fazla.
 *
 * Sonuç bir hesap hatası değil ama avukatın müvekkiline verdiği ödeme planında
 * "11 taksit 85,33 ₺, son taksit 85,45 ₺" gibi açıklanamayan bir satır üretiyor.
 *
 * ÇÖZÜM: hesap kuruş (tam sayı) üzerinden yapılır. Kayan nokta yalnız girişte
 * bir kez yuvarlanır, sonrası tam sayı aritmetiğidir; bölünemeyen artan kuruşlar
 * son taksite eklenir (mevcut davranışın kasıtlı tarafı korunmuştur).
 *
 * NEDEN AYRI DOSYA: hesap `usePaymentPromises` içine gömülüydü ve o dosya
 * supabase/react-query'ye bağlı olduğu için test edilemiyordu.
 */

export interface TaksitPlani {
  /** Her taksitin tutarı (₺), sırayla. Son eleman artan kuruşları taşır. */
  tutarlar: number[];
  /** Bölüştürülen toplam (₺) — girişin kuruşa yuvarlanmış hâli. */
  toplam: number;
}

/**
 * Toplamı `adet` taksite böler.
 *
 * Geçersiz girişte (adet < 1, toplam ≤ 0 ya da sayı değil) BOŞ plan döner —
 * çağıran taraf bunu kaydetmemelidir. Uydurma bir taksit üretmek, sıfır tutarlı
 * satırları veritabanına yazmaktan daha kötüdür.
 */
export function taksitBolustur(toplam: number, adet: number): TaksitPlani {
  if (!Number.isFinite(toplam) || !Number.isFinite(adet)) return { tutarlar: [], toplam: 0 };
  const n = Math.floor(adet);
  if (n < 1 || toplam <= 0) return { tutarlar: [], toplam: 0 };

  // Tek yuvarlama noktası burasıdır; sonrası tam sayı aritmetiği.
  const toplamKurus = Math.round(toplam * 100);
  if (toplamKurus < 1) return { tutarlar: [], toplam: 0 };

  const temel = Math.floor(toplamKurus / n);
  const artan = toplamKurus - temel * n; // 0 .. n-1

  const tutarlar: number[] = [];
  for (let i = 0; i < n; i++) {
    const kurus = i === n - 1 ? temel + artan : temel;
    tutarlar.push(kurus / 100);
  }

  return { tutarlar, toplam: toplamKurus / 100 };
}
