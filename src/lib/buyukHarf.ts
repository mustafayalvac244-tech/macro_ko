import { getLang, useLangStore, type Lang } from '@/i18n';

/**
 * DİLE GÖRE DOĞRU BÜYÜK HARF.
 *
 * NEDEN VAR. Ekranda rozetleri büyük harfe çeviren şey CSS'ti
 * (`textTransform: 'uppercase'`). CSS'in dil bilgisi yok: Türkçe "i" harfini
 * İngilizce kuralıyla "I" yapıyor. Sonuç canlıda görüldü (15.09.2026, dava
 * listesi ekran görüntüsü): "Kritik" → **KRITIK**. Doğrusu **KRİTİK**.
 * Aynı hata daha önce panodaki "Aktif Dosya" → "AKTIF DOSYA" olarak da
 * yaşandı ve orada metin i18n'de zaten büyük yazılarak çözülmüştü.
 *
 * NEDEN toLocaleUpperCase('tr') HER YERDE DOĞRU DEĞİL. İngilizce arayüzde
 * Türkçe kuralı uygulamak ters yönde aynı hatadır: "critical" → "CRİTİCAL".
 * Bu yüzden kural dilden okunuyor, sabit değil.
 *
 * Dil parametresi verilmezse etkin dil kullanılır. React bileşeni içindeyseniz
 * `useBuyukHarf()` kancasını tercih edin: dil değişince yeniden çizilir.
 */
export function buyukHarf(metin: string, dil: Lang = getLang()): string {
  return metin.toLocaleUpperCase(dil === 'tr' ? 'tr-TR' : 'en-US');
}

/** Bileşenler için: dil değiştiğinde yeniden çizilmeyi de sağlar. */
export function useBuyukHarf(): (metin: string) => string {
  const lang = useLangStore((s) => s.lang);
  return (metin: string) => buyukHarf(metin, lang);
}
