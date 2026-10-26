import { describe, expect, it } from 'vitest';

import {
  aynalaHarita, cokgenAlani, GorunumHaritasi, noktadakiParca, PARCA_HARITALARI,
} from '../arac-audit-app/src/cekirdek/gorunumParcalari';

// 26.10.2026 — ürün sahibi: "sol ön garnişe tıklayınca o parça seçilsin."
// Döndürülebilir araç görünümünde parça çokgenleri. Beklentileri ben yazdım.

const kare = (x0: number, y0: number, x1: number, y1: number) =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as const;

describe('noktadakiParca', () => {
  const harita: GorunumHaritasi = {
    oran: 2,
    alanlar: [
      { parcaId: 'sol_on_kapi', nokta: kare(0.1, 0.1, 0.9, 0.9) },
      { parcaId: 'sol_kapi_kolu', nokta: kare(0.4, 0.4, 0.6, 0.6) },
    ],
  };

  it('iç içe karelerde küçük olan kazanır; dışta büyük; hiçbirinde değilse null', () => {
    expect(noktadakiParca(harita, 0.5, 0.5)).toBe('sol_kapi_kolu');
    expect(noktadakiParca(harita, 0.2, 0.2)).toBe('sol_on_kapi');
    expect(noktadakiParca(harita, 0.95, 0.5)).toBeNull();
    expect(noktadakiParca(harita, 0.5, 0.05)).toBeNull();
  });

  it('sıra fark etmez: küçük önce de yazılsa küçük kazanır', () => {
    const ters: GorunumHaritasi = { oran: 2, alanlar: [...harita.alanlar].reverse() };
    expect(noktadakiParca(ters, 0.5, 0.5)).toBe('sol_kapi_kolu');
  });

  it('içbükey çokgen: girintideki nokta dışarıda sayılır', () => {
    // "C" biçimi: sağ ortası oyuk.
    const c: GorunumHaritasi = {
      oran: 1,
      alanlar: [{ parcaId: 'c', nokta: [[0, 0], [1, 0], [1, 0.3], [0.4, 0.3], [0.4, 0.7], [1, 0.7], [1, 1], [0, 1]] }],
    };
    expect(noktadakiParca(c, 0.2, 0.5)).toBe('c');
    expect(noktadakiParca(c, 0.7, 0.5)).toBeNull();
    expect(noktadakiParca(c, 0.7, 0.15)).toBe('c');
  });

  it('alan: birim kare 1, üçgen 0,5; ikiden az köşeli alan yok sayılır', () => {
    expect(cokgenAlani(kare(0, 0, 1, 1))).toBeCloseTo(1, 12);
    expect(cokgenAlani([[0, 0], [1, 0], [0, 1]])).toBeCloseTo(0.5, 12);
    expect(noktadakiParca({ oran: 1, alanlar: [{ parcaId: 'cizgi', nokta: [[0, 0], [1, 1]] }] }, 0.5, 0.5)).toBeNull();
  });
});

describe('aynalaHarita', () => {
  const sol: GorunumHaritasi = {
    oran: 2,
    alanlar: [
      { parcaId: 'sol_on_kapi', nokta: kare(0.1, 0.2, 0.3, 0.8) },
      { parcaId: 'kaput', nokta: kare(0.5, 0.1, 0.6, 0.2) },
      { parcaId: 'sag_ayna', nokta: kare(0.7, 0.3, 0.8, 0.4) },
    ],
  };
  const ayna = aynalaHarita(sol);

  it('x → 1 − x; sol_ ↔ sag_; tarafsız kimlik aynı; oran korunur', () => {
    expect(ayna.oran).toBe(2);
    expect(ayna.alanlar.map((a) => a.parcaId)).toEqual(['sag_on_kapi', 'kaput', 'sol_ayna']);
    expect(noktadakiParca(sol, 0.2, 0.5)).toBe('sol_on_kapi');
    expect(noktadakiParca(ayna, 0.8, 0.5)).toBe('sag_on_kapi');
    expect(noktadakiParca(ayna, 0.2, 0.5)).toBeNull();
    expect(noktadakiParca(ayna, 0.25, 0.35)).toBe('sol_ayna');
  });

  it('iki kez aynalamak ilk haritayı verir; ilk harita değişmez', () => {
    const iki = aynalaHarita(ayna);
    expect(iki.alanlar.map((a) => a.parcaId)).toEqual(sol.alanlar.map((a) => a.parcaId));
    expect(iki.alanlar[0]!.nokta[0]![0]).toBeCloseTo(0.1, 12);
    expect(sol.alanlar[0]!.parcaId).toBe('sol_on_kapi');
  });
});

describe('veri', () => {
  it('veri ayrı hazırlanıyor; bu dosyada boş başlar', () => {
    expect(PARCA_HARITALARI).toEqual({});
  });
});
