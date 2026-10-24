import { describe, expect, it } from 'vitest';

import {
  HataKaydi, haftalikDpu, pareto, sistemeGore, sureDakika, sureMetni, tekrarlayanlar,
} from '../arac-audit-app/src/cekirdek/istatistik';
import { bolgelerAracIcin } from '../arac-audit-app/src/cekirdek/katalog';
import {
  eksikSistemler, kapsamMetni, mevcutSistemler, parcaSistemi, SISTEMLER, sistemAdi,
} from '../arac-audit-app/src/cekirdek/sistemler';

// 24.10.2026 — benzer uygulamaların incelenmesi: Pareto, tekrarlayan hata,
// haftalık DPU eğilimi, kapsam (kontrol listesi), denetim süresi.

const k = (denetimId: string, parcaId: string, hataTipiId: string, kabul = false): HataKaydi => ({
  denetimId, aracId: 'ioniq3', parcaId, hataTipiId, derece: '2', kabulEdilebilir: kabul,
  denetimBaslangici: '2026-10-20T08:00:00',
});

describe('pareto', () => {
  it('düzeltilecek adede göre sıralar, kabul edilebilirleri saymaz, birikimli payı hesaplar', () => {
    const p = pareto([
      k('d1', 'kaput', 'cizik'), k('d2', 'kaput', 'cizik'), k('d3', 'kaput', 'cizik'),
      k('d1', 'sol_on_kapi', 'gocuk'), k('d1', 'sol_on_kapi', 'gocuk'),
      k('d2', 'tavan', 'cizik', true), // kabul edilebilir: Pareto'da yok
    ]);
    expect(p.map((x) => [x.parcaId, x.hataTipiId, x.adet, x.aracSayisi])).toEqual([
      ['kaput', 'cizik', 3, 3], ['sol_on_kapi', 'gocuk', 2, 1],
    ]);
    expect(p[0]!.pay).toBeCloseTo(0.6);
    expect(p[0]!.birikimli).toBeCloseTo(0.6);
    expect(p[1]!.birikimli).toBeCloseTo(1);
  });

  it('eşitlikte çok araçta görülen önce; boş liste boş döner', () => {
    const p = pareto([k('d1', 'a', 'x'), k('d1', 'a', 'x'), k('d1', 'b', 'y'), k('d2', 'b', 'y')]);
    expect(p[0]).toMatchObject({ parcaId: 'b', aracSayisi: 2 });
    expect(pareto([])).toEqual([]);
  });
});

describe('tekrarlayanlar', () => {
  it('yalnız en az iki ayrı araçta görülen çiftler; tek araçta üç kez olan girmez', () => {
    const t = tekrarlayanlar([
      k('d1', 'a', 'x'), k('d1', 'a', 'x'), k('d1', 'a', 'x'),
      k('d1', 'b', 'y'), k('d2', 'b', 'y'),
      k('d2', 'c', 'z'), k('d3', 'c', 'z'), k('d4', 'c', 'z'),
    ]);
    expect(t.map((x) => [x.parcaId, x.aracSayisi])).toEqual([['c', 3], ['b', 2]]);
  });
});

describe('sistemeGore', () => {
  it('sistem başına hata/düzeltilecek ve dönemin araç sayısıyla DPU', () => {
    const satirlar = sistemeGore(
      [k('d1', 'kaput', 'cizik'), k('d2', 'kaput', 'gocuk', true), k('d1', 'surucu_koltuk', 'leke')],
      parcaSistemi, 4, SISTEMLER.map((s) => s.id),
    );
    expect(satirlar.map((s) => [s.sistem, s.hata, s.duzeltilecek, s.dpu])).toEqual([
      ['dis', 2, 1, 0.25], ['ic', 1, 1, 0.25],
    ]);
  });
});

describe('haftalikDpu', () => {
  const yerel = (y: number, ay: number, g: number, sa = 10) => new Date(y, ay - 1, g, sa);
  const girdi = (an: Date, duz: number) => ({ aracId: 'i20', baslangic: an.toISOString(), hataAdedi: duz, duzeltilecekAdedi: duz });

  it('son 8 hafta, pazartesi başlangıçlı, eskiden yeniye; boş hafta DPU null', () => {
    const simdi = yerel(2026, 10, 21); // çarşamba; hafta 19.10
    const h = haftalikDpu([
      girdi(yerel(2026, 10, 20), 2), girdi(yerel(2026, 10, 19), 0), // bu hafta: 2 araç, 2 → 1,00
      girdi(yerel(2026, 10, 18), 3), // pazar: geçen hafta
      girdi(yerel(2026, 8, 30), 1), // 8 haftadan eski: sayılmaz (ilk hafta 31.08)
      girdi(yerel(2026, 8, 31), 1), // ilk haftanın pazartesisi: sayılır
    ], simdi, 8);
    expect(h).toHaveLength(8);
    expect(h[0]!.baslangic).toEqual(yerel(2026, 8, 31, 0));
    expect(h[7]!.baslangic).toEqual(yerel(2026, 10, 19, 0));
    expect(h[7]).toMatchObject({ arac: 2, duzeltilecek: 2, dpu: 1 });
    expect(h[6]).toMatchObject({ arac: 1, duzeltilecek: 3, dpu: 3 });
    expect(h[0]).toMatchObject({ arac: 1, duzeltilecek: 1, dpu: 1 });
    expect(h[3]).toMatchObject({ arac: 0, dpu: null });
  });
});

describe('süre', () => {
  it('tam dakika; bitmemiş, bozuk ve geri giden zaman null', () => {
    expect(sureDakika('2026-10-24T08:00:00', '2026-10-24T08:12:59')).toBe(12);
    expect(sureDakika('2026-10-24T08:00:00', null)).toBeNull();
    expect(sureDakika('2026-10-24T08:00:00', 'bozuk')).toBeNull();
    expect(sureDakika('2026-10-24T08:10:00', '2026-10-24T08:00:00')).toBeNull();
  });
  it('metin: dk, sa dk, < 1 dk; İngilizce', () => {
    expect(sureMetni(12)).toBe('12 dk');
    expect(sureMetni(65)).toBe('1 sa 05 dk');
    expect(sureMetni(0)).toBe('< 1 dk');
    expect(sureMetni(65, 'en')).toBe('1 h 05 min');
    expect(sureMetni(null)).toBe('');
  });
});

describe('sistemler ve kapsam', () => {
  it('parçanın sistemi ve araçtaki sistemler', () => {
    expect(parcaSistemi('kaput')).toBe('dis');
    expect(parcaSistemi('surucu_koltuk')).toBe('ic');
    expect(parcaSistemi('yok-boyle-parca')).toBeNull();
    expect(mevcutSistemler(bolgelerAracIcin({ tip: 'ev' }))).toEqual(['dis', 'ic', 'motor', 'fonksiyon', 'surus']);
    expect(sistemAdi('dis')).toBe('Dış');
    expect(sistemAdi('dis', 'en')).toBe('Exterior');
  });

  it('eksik sistemler ve künye metni', () => {
    const mevcut = mevcutSistemler(bolgelerAracIcin({ tip: 'ice' }));
    expect(eksikSistemler(['dis', 'ic'], mevcut)).toEqual(['motor', 'fonksiyon', 'surus']);
    expect(kapsamMetni(['ic', 'dis'], mevcut)).toBe('Dış, İç (2/5)');
    expect(kapsamMetni([], mevcut)).toBe('— (0/5)');
    expect(kapsamMetni(['dis'], mevcut, 'en')).toBe('Exterior (1/5)');
  });
});
