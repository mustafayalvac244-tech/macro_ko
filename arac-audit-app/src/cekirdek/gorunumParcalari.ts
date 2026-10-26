// GÖRÜNÜM PARÇA HARİTALARI — araç görselinde parça çokgenleri.
//
// Ürün sahibi, 26.10.2026: "sol ön garnişe tıklayınca o parça seçilsin."
// Döndürülebilir araç görünümünde (DonusGorunumu.tsx) her standart bakışın
// görseli için parça çokgenleri. Koordinatlar GÖRSELE göre normalize: x 0–1
// soldan sağa, y 0–1 yukarıdan aşağı; `oran` görselin beklenen en/boy oranı.
// Görselin oranı haritanınkiyle %2 içinde uyuşmazsa harita kullanılmaz,
// görünüm yüz düzeyine (bölge seçimi) döner — yanlış görsele çizilmiş harita
// yanlış parçayı seçmesin.
//
// Veri ayrı dosyada (ioniq3Haritasi.ts — bugün yalnız IONIQ 3'ün haritası
// var); bu dosya mekanizmayı taşır. Katalogda olmayan parça kimliği görünümde
// yok sayılır. Görsellerin kendisi burada DEĞİL — telefonda
// (veri/aracGorselleri.ts).

import { IONIQ3_HARITASI } from './ioniq3Haritasi';

export type GorunumId = 'on' | 'sol_on' | 'sol' | 'sol_arka' | 'arka' | 'sag_arka' | 'sag' | 'sag_on' | 'ust';

/** Çokgen, GÖRSELE göre normalize: x 0..1 soldan sağa, y 0..1 yukarıdan aşağı. */
export interface ParcaAlani { parcaId: string; nokta: readonly (readonly [number, number])[] }

/** `oran` = beklenen görsel en/boy oranı (ör. 2). */
export interface GorunumHaritasi { oran: number; alanlar: readonly ParcaAlani[] }

/** Araç kimliği (ör. 'ioniq3') → bakış → harita. */
export const PARCA_HARITALARI: Record<string, Partial<Record<GorunumId, GorunumHaritasi>>> = {
  ioniq3: IONIQ3_HARITASI,
};

/** Çokgenin alanı (shoelace), mutlak değer. */
export function cokgenAlani(nokta: readonly (readonly [number, number])[]): number {
  let t = 0;
  for (let i = 0; i < nokta.length; i++) {
    const [x1, y1] = nokta[i]!;
    const [x2, y2] = nokta[(i + 1) % nokta.length]!;
    t += x1 * y2 - x2 * y1;
  }
  return Math.abs(t) / 2;
}

/** Nokta çokgenin içinde mi (ışın atma; kenar üstü belirsiz, önemsiz). */
export function cokgenIcinde(nokta: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let icinde = false;
  for (let i = 0, j = nokta.length - 1; i < nokta.length; j = i++) {
    const [xi, yi] = nokta[i]!;
    const [xj, yj] = nokta[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) icinde = !icinde;
  }
  return icinde;
}

/**
 * Noktadaki parça. Birden çok çokgen içeriyorsa EN KÜÇÜK alanlısı kazanır:
 * kol, ayna gibi küçük parçalar büyük panellerin üstüne çizilir. Hiçbiri
 * içermiyorsa null.
 */
export function noktadakiParca(h: GorunumHaritasi, x: number, y: number): string | null {
  let enIyi: { parcaId: string; alan: number } | null = null;
  for (const a of h.alanlar) {
    if (a.nokta.length < 3 || !cokgenIcinde(a.nokta, x, y)) continue;
    const alan = cokgenAlani(a.nokta);
    if (!enIyi || alan < enIyi.alan) enIyi = { parcaId: a.parcaId, alan };
  }
  return enIyi?.parcaId ?? null;
}

const tarafiCevir = (id: string): string =>
  id.startsWith('sol_') ? `sag_${id.slice(4)}` : id.startsWith('sag_') ? `sol_${id.slice(4)}` : id;

/**
 * Aynalanmış bakış için: x → 1 − x ve parça kimliklerinde 'sol_' ↔ 'sag_'.
 * Sağ yan görseli yoksa sol yanın aynası gösterilir; haritası da böyle elde
 * edilir.
 */
export function aynalaHarita(h: GorunumHaritasi): GorunumHaritasi {
  return {
    oran: h.oran,
    alanlar: h.alanlar.map((a) => ({
      parcaId: tarafiCevir(a.parcaId),
      nokta: a.nokta.map(([x, y]) => [1 - x, y] as const),
    })),
  };
}
