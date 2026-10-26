// EXCEL'E AKTARILACAK DENETİMLER (26.10.2026).
//
// İkinci dış değerlendirmede kalite müdürü: "Excel'e aktar" bütün denetimleri,
// yarım kalanlar da dahil, tek dosyaya döküyordu; dönem seçilemiyordu. Ekip
// satırları haftalık/aylık kendi kitabına yapıştırdığı için yarım denetim oraya
// "bitmiş" gibi geçiyordu. Varsayılan: yalnız bitmiş denetimler, bütün zamanlar.
// Dönem sınırları ana sayfa sayacıyla AYNI (sayac.ts), denetimin başladığı ana göre.

import { Donem, donemBaslangiclari, donemIcinde } from './sayac';

export type AktarimDonemi = 'hepsi' | Donem;

export interface AktarimSecimi {
  donem: AktarimDonemi;
  /** Devam eden (bitmemiş) denetimler de aktarılsın mı? */
  devamDahil: boolean;
}

export const VARSAYILAN_AKTARIM: AktarimSecimi = { donem: 'hepsi', devamDahil: false };

export function aktarilacaklar<T extends { baslangic: string; durum?: string }>(
  denetimler: readonly T[], secim: AktarimSecimi, simdi: Date,
): { secilen: T[]; disaridaDevam: number } {
  const sinir = donemBaslangiclari(simdi);
  const donemde = secim.donem === 'hepsi'
    ? [...denetimler]
    : denetimler.filter((d) => donemIcinde(new Date(d.baslangic), secim.donem as Donem, sinir));
  const secilen = secim.devamDahil ? donemde : donemde.filter((d) => d.durum !== 'devam');
  return { secilen, disaridaDevam: donemde.length - secilen.length };
}
