import { describe, expect, it } from 'vitest';
import { oranOku, oranYaz, tutarOku, tutarYaz } from '../src/utils/tutar';

// Her satır denetimde bulunan gerçek bir hatanın girdisi: eski ayrıştırıcı
// parantezdeki değeri veriyordu.
describe('tutarOku — denetimde bulunan girdiler', () => {
  it.each([
    ['1250.5', 1250.5], // finans/saat ücreti düzenleme (12505)
    ['333.33', 333.33], // taksit taslağı (33333)
    ['12500.75', 12500.75], // icra düzenleme (1250075)
    ['10.000', 10000], // dava detayı tahsilat (10)
    ['25.000', 25000], // dava detayı (25)
    ['1.250,50', 1250.5], // müvekkil avansı (NaN)
    ['50.000', 50000], // dava formu ücret (50)
    ['1.250.000', 1250000], // dava formu ücret (null)
  ])('%s → %s', (girdi, beklenen) => {
    expect(tutarOku(girdi)).toBe(beklenen);
  });
});

describe('tutarOku — biçimler', () => {
  it.each([
    ['1250', 1250],
    ['1250,5', 1250.5],
    ['1250,50', 1250.5],
    ['1.250.000,75', 1250000.75],
    ['1,250.50', 1250.5],
    ['₺1.250,50', 1250.5],
    ['1.250,50 TL', 1250.5],
    [' 1 250,50 ', 1250.5],
    ['0,5', 0.5],
    ['0.250', 0.25],
    [',5', 0.5],
    ['1.', 1],
  ])('%s → %s', (girdi, beklenen) => {
    expect(tutarOku(girdi)).toBe(beklenen);
  });

  it.each(['', '  ', 'abc', '1.25.000', '1.250,50,3', '-100', '12a', '.', ',', '1.2345.678'])(
    'geçersiz: %j → NaN',
    (girdi) => {
      expect(Number.isNaN(tutarOku(girdi))).toBe(true);
    }
  );

  it('null/undefined → NaN', () => {
    expect(Number.isNaN(tutarOku(null))).toBe(true);
    expect(Number.isNaN(tutarOku(undefined))).toBe(true);
  });
});

describe('tutarYaz → tutarOku gidiş-dönüş', () => {
  it.each([0.01, 0.5, 1, 99.99, 333.33, 333.34, 1250.5, 12500.75, 1000000, 1234567.89])('%s', (n) => {
    expect(tutarOku(tutarYaz(n))).toBe(n);
  });

  it('biçim', () => {
    expect(tutarYaz(1250.5)).toBe('1250,50');
    expect(tutarYaz(12500)).toBe('12500');
    expect(tutarYaz('1250.5')).toBe('1250,50');
    expect(tutarYaz(null)).toBe('');
    expect(tutarYaz(NaN)).toBe('');
  });

  it('kuruş taraması: 0,01–2.000,00 arasındaki her tutar gidiş-dönüşte aynı kalır', () => {
    for (let k = 1; k <= 200000; k++) {
      const n = k / 100;
      if (tutarOku(tutarYaz(n)) !== n) throw new Error(`bozuldu: ${n}`);
    }
  });
});

describe('oranOku / oranYaz', () => {
  it.each([
    ['24.5', 24.5], // icra faizi (245)
    ['24,5', 24.5],
    ['%20', 20],
    ['20', 20],
    ['0,75', 0.75],
  ])('%s → %s', (girdi, beklenen) => {
    expect(oranOku(girdi)).toBe(beklenen);
  });

  it.each(['', 'abc', '1.000.5', '-5'])('geçersiz: %j', (girdi) => {
    expect(Number.isNaN(oranOku(girdi))).toBe(true);
  });

  it('gidiş-dönüş', () => {
    for (const n of [0, 0.75, 9, 20, 24.5, 36.25]) expect(oranOku(oranYaz(n))).toBe(n);
  });
});
