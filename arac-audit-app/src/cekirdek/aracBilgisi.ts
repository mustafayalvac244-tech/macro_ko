// ARAÇ BİLGİSİ — denetlenen aracın spec'i ve kilometresi.
//
// Ürün sahibi, 28.09.2026: "Spec seçimi de ekleyelim LH RH km bilgisi
// yazalım." İkisi de ARACA özgüdür (şasi ve plaka gibi): bir sonraki denetime
// hatırlanıp taşınmaz, her araçta yeniden girilir.
//
// "LH / RH"nin anlamı ekipten teyit edilmedi. Fabrika dilinde çoğunlukla
// direksiyon tarafıdır (LHD / RHD — soldan / sağdan direksiyonlu pazar);
// uygulama değeri yorumlamadan, seçildiği gibi rapora yazar.

import { Dil } from './tipler';

export const SPECLER: readonly string[] = ['LH', 'RH'];

/** Kilometrede tutulan en büyük değer: 7 hane. Daha uzunu yazım hatasıdır. */
export const KM_HANE = 7;

/**
 * Kutuya yazılanı yalnız rakama indirir (en çok 7 hane). Kutu hiçbir zaman
 * rakam dışı bir şey tutmaz; "12.345" yapıştırılırsa 12345 olur.
 */
export function kmSadelestir(ham: string): string {
  return ham.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, KM_HANE);
}

/** Boş → null (girilmedi). 0 geçerli bir değerdir: sıfır kilometre araç. */
export function kmAyikla(ham: string): number | null {
  const temiz = kmSadelestir(ham);
  return temiz ? Number(temiz) : null;
}

/**
 * "12.345 km" (tr) / "12,345 km" (en). Girilmemişse boş metin.
 * Binlik ayırıcı ELLE konuyor: `toLocaleString` her JavaScript motorunda aynı
 * sonucu vermiyor (tablet ile tarayıcı farklı yazabilir), rapor ise hep aynı
 * çıkmalı.
 */
export function kmGoster(km: number | null | undefined, dil: Dil = 'tr'): string {
  if (km === null || km === undefined || !Number.isFinite(km)) return '';
  const ayirici = dil === 'en' ? ',' : '.';
  return `${String(Math.trunc(km)).replace(/\B(?=(\d{3})+(?!\d))/g, ayirici)} km`;
}
