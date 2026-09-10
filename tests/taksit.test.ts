import { describe, expect, it } from 'vitest';
import { taksitBolustur } from '@/utils/taksit';

/**
 * TAKSİT BÖLÜŞTÜRME.
 *
 * Eski hesap (`floor(toplam/adet*100)/100`) toplamı doğru veriyordu ama kayan
 * nokta yüzünden bir kuruş aşağı kayıp farkı son taksite yığabiliyordu: ölçümde
 * 1.000–50.000 ₺ aralığındaki ~24,5 milyon kombinasyonun ~%2'sinde taksitler
 * eşit çıkması gerekirken eşit çıkmıyordu (en kötüsü: son taksit 12 kuruş
 * fazla). Bu testler hem toplamı hem de DAĞITIMI bağlar.
 */

const topla = (t: number[]) => Math.round(t.reduce((a, b) => a + b, 0) * 100) / 100;

describe('taksitBolustur — tam bölünen tutarlar', () => {
  it('eşit bölünen tutarı eşit böler', () => {
    expect(taksitBolustur(1200, 3).tutarlar).toEqual([400, 400, 400]);
    expect(taksitBolustur(7000, 7).tutarlar).toEqual([1000, 1000, 1000, 1000, 1000, 1000, 1000]);
  });

  it('tek taksitte tutarın tamamını verir', () => {
    expect(taksitBolustur(1234.56, 1).tutarlar).toEqual([1234.56]);
  });
});

describe('taksitBolustur — düzeltilen kayan nokta sapması', () => {
  it('1.024,08 ₺ / 12 taksit: hepsi 85,34 (eski hesap 85,33 × 11 + 85,45 veriyordu)', () => {
    const { tutarlar } = taksitBolustur(1024.08, 12);
    expect(tutarlar).toEqual(Array(12).fill(85.34));
    expect(topla(tutarlar)).toBe(1024.08);
  });

  it('1.024,10 ₺ / 2 taksit: 512,05 + 512,05 (eski hesap 512,04 + 512,06)', () => {
    expect(taksitBolustur(1024.1, 2).tutarlar).toEqual([512.05, 512.05]);
  });

  it('0,21 ₺ / 3 taksit: 0,07 × 3 (eski hesap 0,06 + 0,06 + 0,09)', () => {
    expect(taksitBolustur(0.21, 3).tutarlar).toEqual([0.07, 0.07, 0.07]);
  });
});

describe('taksitBolustur — bölünemeyen kuruş son taksite eklenir', () => {
  it('100 ₺ / 3 taksit', () => {
    const { tutarlar } = taksitBolustur(100, 3);
    expect(tutarlar).toEqual([33.33, 33.33, 33.34]);
    expect(topla(tutarlar)).toBe(100);
  });

  it('artan yalnız SON taksite eklenir, aradakiler eşit kalır', () => {
    const { tutarlar } = taksitBolustur(10, 3);
    const araTaksitler = tutarlar.slice(0, -1);
    expect(new Set(araTaksitler).size).toBe(1);
    expect(tutarlar[tutarlar.length - 1]!).toBeGreaterThanOrEqual(araTaksitler[0]!);
  });

  it('son taksit, aradakilerden en fazla (adet-1) kuruş fazla olabilir', () => {
    for (const adet of [2, 3, 6, 12, 24]) {
      const { tutarlar } = taksitBolustur(1000.01, adet);
      const fark = Math.round((tutarlar[tutarlar.length - 1]! - tutarlar[0]!) * 100);
      expect(fark, `adet=${adet}`).toBeLessThanOrEqual(adet - 1);
      expect(fark, `adet=${adet}`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('taksitBolustur — toplam ASLA kaybolmaz', () => {
  it('geniş bir taramada toplam her zaman korunur', () => {
    // Bu, eski hesabın da doğru yaptığı taraftı; yeni hesapta bozulmadığını
    // kanıtlamak için bağlandı.
    for (let kurus = 1; kurus <= 200000; kurus += 137) {
      const toplam = kurus / 100;
      for (const adet of [2, 3, 4, 6, 12]) {
        const { tutarlar } = taksitBolustur(toplam, adet);
        expect(topla(tutarlar), `${toplam} / ${adet}`).toBe(toplam);
        expect(tutarlar).toHaveLength(adet);
      }
    }
  });

  it('her taksit iki ondalıktan uzun olmaz (kuruştan küçük tutar üretmez)', () => {
    for (const [toplam, adet] of [[1000.01, 7], [999.99, 3], [0.07, 3]] as const) {
      for (const t of taksitBolustur(toplam, adet).tutarlar) {
        expect(Math.round(t * 100) / 100).toBe(t);
      }
    }
  });
});

describe('taksitBolustur — geçersiz girdi kayıt üretmez', () => {
  it('sıfır/negatif tutarda boş plan döner', () => {
    expect(taksitBolustur(0, 3).tutarlar).toEqual([]);
    expect(taksitBolustur(-100, 3).tutarlar).toEqual([]);
  });

  it('adet 1den küçükse boş plan döner', () => {
    expect(taksitBolustur(1000, 0).tutarlar).toEqual([]);
    expect(taksitBolustur(1000, -2).tutarlar).toEqual([]);
  });

  it('sayı olmayan girdide çökmez', () => {
    expect(taksitBolustur(NaN, 3).tutarlar).toEqual([]);
    expect(taksitBolustur(1000, NaN).tutarlar).toEqual([]);
    expect(taksitBolustur(Infinity, 3).tutarlar).toEqual([]);
  });

  it('yarım kuruşun altındaki tutar taksitlendirilmez', () => {
    // 0,004 ₺ kuruşa yuvarlanınca 0 eder; sıfır tutarlı satır yazmak yerine
    // hiç plan üretilmez.
    expect(taksitBolustur(0.004, 3).tutarlar).toEqual([]);
  });

  it('ondalıklı adet aşağı yuvarlanır', () => {
    expect(taksitBolustur(300, 3.9).tutarlar).toEqual([100, 100, 100]);
  });
});
