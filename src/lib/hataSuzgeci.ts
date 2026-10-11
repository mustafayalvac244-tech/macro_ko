/**
 * HATA KAYDI SÜZGECİ — saf (AJAN 28, 10.10.2026).
 *
 * Web'de `window.onerror` / `unhandledrejection` dinlenmeye başlayınca iki
 * risk doğar: (1) zararsız tarayıcı gürültüsünün tabloyu doldurması,
 * (2) bir döngüde patlayan hatanın saniyede yüzlerce satır yazması.
 * İkisi de burada, tek yerde kapatılır.
 */

/**
 * Teşhis değeri olmayan, tarayıcının kendi bildirimleri:
 *  - ResizeObserver döngü uyarısı (düzen hatası değil, tarayıcı uyarısı)
 *  - "Script error." (başka kaynaktan gelen betikte ayrıntısız hata)
 */
const GURULTU = [/^ResizeObserver loop/i, /^Script error\.?$/i];

export function hataKaydedilmeli(mesaj: string): boolean {
  const m = mesaj.trim();
  return !GURULTU.some((r) => r.test(m));
}

/**
 * Oturum başına kayıt kapısı: aynı anahtar bir kez, toplamda en çok `azami`.
 * Dönen işlev kaydedilmeli mi sorusuna true/false verir.
 * Varsayılan sınır bir TASARIM SINIRIDIR — ölçülmedi, tahmin.
 */
export function hataKapisi(azami = 30): (anahtar: string) => boolean {
  const gorulen = new Set<string>();
  return (anahtar) => {
    if (gorulen.has(anahtar) || gorulen.size >= azami) return false;
    gorulen.add(anahtar);
    return true;
  };
}
