// HATA TAKİBİ (26.10.2026) — bir kaydın kapanana kadarki yolu.
//
// Ekibin Excel'inde PROGRESS, COUNTERMEASURE, CM APPLICATION DATE ve
// VERIFICATION BODY NO sütunları var ve az da olsa kullanılıyor (ölçüm, ekibin
// dosyası: 3.499 satırın 273'ünde PROGRESS = "SHARED", 211'inde önlem metni,
// 191'inde önlem tarihi). Excel'e yazılış nas.ts → ilerlemeKodu.
//
// Dört durum mevcut şemadan (HataDurumu); yeni bir etiket uydurulmadı, Excel'e
// yalnız "SHARED" gider. Sıra: açık → paylaşıldı → önlem uygulandı → doğrulandı.

import { Dil, Hata, HataDurumu } from './tipler';

export const TAKIP_DURUMLARI: readonly { id: HataDurumu; ad: string; en: string }[] = [
  { id: 'acik', ad: 'Açık', en: 'Open' },
  { id: 'atandi', ad: 'Paylaşıldı', en: 'Shared' },
  { id: 'giderildi', ad: 'Önlem uygulandı', en: 'Countermeasure applied' },
  { id: 'kapali', ad: 'Doğrulandı', en: 'Verified' },
];

export function takipAdi(durum: string | null | undefined, dil: Dil = 'tr'): string {
  const d = TAKIP_DURUMLARI.find((x) => x.id === durum) ?? TAKIP_DURUMLARI[0]!;
  return dil === 'en' ? d.en : d.ad;
}

/**
 * Durum değişince tarih alanları: önlem uygulandı/doğrulandı'ya geçilince önlem
 * tarihi (CM APPLICATION DATE) yoksa şimdi yazılır; açık/paylaşıldı'ya
 * dönülünce silinir (geri alınmış önlemin tarihi Excel'e gitmesin).
 * Doğrulama zamanı yalnız 'kapali'da durur.
 */
export function durumDegistir(
  h: Pick<Hata, 'durum' | 'giderilmeZamani' | 'dogrulamaZamani'>, yeni: HataDurumu, simdi: string,
): Pick<Hata, 'durum' | 'giderilmeZamani' | 'dogrulamaZamani'> {
  const onlemli = yeni === 'giderildi' || yeni === 'kapali';
  return {
    durum: yeni,
    giderilmeZamani: onlemli ? (h.giderilmeZamani || simdi) : null,
    dogrulamaZamani: yeni === 'kapali' ? (h.dogrulamaZamani || simdi) : null,
  };
}

/** Rapor ve listelerde "açık" sayılan: henüz önlemi uygulanmamış. */
export const acikMi = (h: Pick<Hata, 'durum'>): boolean => !h.durum || h.durum === 'acik' || h.durum === 'atandi';
