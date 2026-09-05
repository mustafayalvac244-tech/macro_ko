import { describe, expect, it } from 'vitest';
import { maddeAtiflari, mesruTutarlar, tarihler, tutarlar } from '../scripts/uydurma.mjs';

/**
 * Bu ayıklayıcılar ölçümün en ağır kararını veriyor: "bu taslakta UYDURMA veri
 * var". Yanlış pozitif, temiz bir taslağı kusurlu gösterip gerçek hataları
 * gölgeler; yanlış negatif ise mahkemeye yanlış tarihle giden bir dilekçeyi
 * onaylar. İkisi de sessiz ve pahalıdır.
 */
describe('tarihler', () => {
  it('üç yazılışı da tek biçime indirger', () => {
    expect([...tarihler('01.02.2026 ve 1/2/2026 ile 2026-02-01')]).toEqual(['2026-02-01']);
  });

  it('tek haneli gün/ayı sıfırla doldurur', () => {
    expect([...tarihler('5.3.2026')]).toEqual(['2026-03-05']);
  });

  it('madde numarasını tarih sanmaz', () => {
    expect([...tarihler('HMK m.119/1-d')]).toEqual([]);
  });
});

describe('tutarlar', () => {
  it('binlik ayracını çözer', () => {
    expect([...tutarlar('36.000,00 TL')]).toEqual([36000]);
    expect([...tutarlar('12 000 TL')]).toEqual([12000]);
  });

  it('para birimi olmayan sayıyı tutar saymaz', () => {
    // "5 yıllık zamanaşımı" bir tutar değildir; sayılsaydı her mütalaa
    // uydurma tutar içeriyor görünürdü.
    expect([...tutarlar('5 yıllık zamanaşımı, TBK m.147')]).toEqual([]);
  });

  it('₺ ve "Türk Lirası" yazılışlarını da alır', () => {
    expect([...tutarlar('250.000 ₺')]).toEqual([250000]);
    expect([...tutarlar('40.000 Türk Lirası')]).toEqual([40000]);
  });
});

describe('mesruTutarlar', () => {
  it('toplam ve katları meşru sayar', () => {
    // "Aylık 12.000 TL kira, üç ay ödenmedi" → 36.000 TL hesaptır, uydurma değil.
    expect(mesruTutarlar(new Set([12000])).has(36000)).toBe(true);
  });

  it('ilgisiz bir tutarı meşru saymaz', () => {
    expect(mesruTutarlar(new Set([12000])).has(97500)).toBe(false);
  });
});

describe('maddeAtiflari', () => {
  it('kısaltma ile atıfı çıkarır', () => {
    expect(maddeAtiflari('TBK m.146 uyarınca')).toEqual([{ kanun: 'TBK', madde: '146' }]);
  });

  it('fıkra ve bent ekini madde numarasına karıştırmaz', () => {
    // "HMK m.119/1-d" tek bir maddedir; 119/1 diye bir madde yoktur ve
    // uydurma sayılırsa doğru bir atıf kusur gösterilirdi.
    expect(maddeAtiflari('HMK m.119/1-d ve İİK m.62/son')).toEqual([
      { kanun: 'HMK', madde: '119' },
      { kanun: 'İİK', madde: '62' },
    ]);
  });

  it('kanunun tam adıyla yazılmış atıfı da çözer', () => {
    expect(maddeAtiflari('İcra ve İflas Kanunu m.66')).toEqual([{ kanun: 'İİK', madde: '66' }]);
  });

  it('kanun numarasıyla yazılmış atıfı çözer', () => {
    expect(maddeAtiflari("4857 sayılı Kanun'un 17. maddesi")).toEqual([{ kanun: 'İşK', madde: '17' }]);
  });

  it('havuzda olmayan bir kanunun atıfını çıkarmaz', () => {
    // Bilmediğimiz bir kanun için "havuzda yok" demek yanlış olurdu:
    // eksik olan bizim korpusumuzdur, modelin atfı değil.
    expect(maddeAtiflari('Kabahatler Kanunu m.32')).toEqual([]);
  });

  it('yinelenen atıfı bir kez döndürür', () => {
    expect(maddeAtiflari('TBK m.146 ... yine TBK m.146')).toHaveLength(1);
  });
});
