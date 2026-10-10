import { describe, expect, it } from 'vitest';
import { ayOzeti, kayitAyda, oranGecerliMi } from '../src/utils/finansHesap';

/**
 * FİNANS AY ÖZETİ — ana ekran (pano), Finans ekranı ve CSV tek hesaptan beslenir
 * (10.10.2026). BU SINAVI BEN YAZDIM; beklenen değerleri de ben seçtim.
 *
 * Bulunan kusurlar:
 *  - Pano "Bu Ay" yalnız o ayın tek seferlik kayıtlarını `amount` ile topluyordu;
 *    Finans ekranı tekrarlı kalemleri, dava tahsilatlarını ve gelirde net_total'ı
 *    da sayıyordu. Aynı ay iki ekranda iki farklı toplam gösteriyordu.
 *  - CSV'nin KDV/stopaj toplamı, ekranda yalnız yönetim için gösterilen
 *    DURDURULMUŞ tekrarlı kalemleri de topluyordu; gelir/gider satırı onları
 *    saymadığı için dosyanın kendi içinde tutmuyordu.
 */

const gelir = (o: Record<string, unknown> = {}) => ({
  kind: 'income' as const,
  amount: 1000 as number | string,
  net_total: 1000 as number | string | null,
  vat_amount: null as number | string | null,
  withholding_amount: null as number | string | null,
  entry_date: '2026-09-10',
  is_recurring: false,
  recurring_until: null as string | null,
  ...o,
});
const gider = (o: Record<string, unknown> = {}) => gelir({ kind: 'expense', net_total: null, ...o });

// Yerel saatle kurulur: testin hangi saat diliminde koştuğundan bağımsız.
const yerel = (y: number, ay: number, gun: number) => new Date(y, ay - 1, gun, 12, 0, 0).toISOString();

describe('kayitAyda', () => {
  it('tek seferlik kayıt yalnız kendi ayında geçerli', () => {
    expect(kayitAyda(gelir({ entry_date: '2026-09-30' }), '2026-09')).toBe(true);
    expect(kayitAyda(gelir({ entry_date: '2026-09-30' }), '2026-10')).toBe(false);
    expect(kayitAyda(gelir({ entry_date: '2026-10-01' }), '2026-09')).toBe(false);
  });

  it('tekrarlı kalem başladığı aydan itibaren, bitiş ayı DAHİL geçerli', () => {
    const k = gider({ is_recurring: true, entry_date: '2026-03-05', recurring_until: '2026-06-30' });
    expect(kayitAyda(k, '2026-02')).toBe(false);
    expect(kayitAyda(k, '2026-03')).toBe(true);
    expect(kayitAyda(k, '2026-06')).toBe(true);
    expect(kayitAyda(k, '2026-07')).toBe(false);
  });

  it('bitişi olmayan tekrarlı kalem sürüyor sayılır', () => {
    const k = gider({ is_recurring: true, entry_date: '2026-03-05' });
    expect(kayitAyda(k, '2030-01')).toBe(true);
  });

  it('okunamayan tarih ayda sayılmaz', () => {
    expect(kayitAyda(gelir({ entry_date: '' }), '2026-09')).toBe(false);
  });
});

describe('ayOzeti', () => {
  it('gelirde net_total, giderde amount sayılır', () => {
    const o = ayOzeti([gelir({ amount: 1000, net_total: 1200 }), gider({ amount: 300 })], [], '2026-09');
    expect(o.gelir).toBe(1200);
    expect(o.gider).toBe(300);
    expect(o.net).toBe(900);
  });

  it('net_total yoksa amount kullanılır', () => {
    const o = ayOzeti([gelir({ amount: 750, net_total: null })], [], '2026-09');
    expect(o.gelir).toBe(750);
  });

  it('tekrarlı kalem her aktif ayda sayılır (pano ile Finans ekranı aynı)', () => {
    const kira = gider({ amount: 15000, is_recurring: true, entry_date: '2026-01-01' });
    expect(ayOzeti([kira], [], '2026-09').gider).toBe(15000);
    expect(ayOzeti([kira], [], '2026-10').gider).toBe(15000);
  });

  it('dava tahsilatları gelire eklenir ve yalnız kendi ayında sayılır', () => {
    const o = ayOzeti(
      [],
      [
        { amount: 500, paid_at: yerel(2026, 9, 1) },
        { amount: 250.5, paid_at: yerel(2026, 9, 30) },
        { amount: 999, paid_at: yerel(2026, 10, 1) },
        { amount: 999, paid_at: yerel(2026, 8, 31) },
      ],
      '2026-09',
    );
    expect(o.odemeToplam).toBe(750.5);
    expect(o.odemeAdet).toBe(2);
    expect(o.gelir).toBe(750.5);
  });

  it('KURUŞ HASSASİYETİ: 0,1 + 0,2 + 0,07 tam 0,37; kayan nokta artığı kalmaz', () => {
    const o = ayOzeti(
      [gelir({ net_total: 0.1 }), gelir({ net_total: 0.2 })],
      [{ amount: 0.07, paid_at: yerel(2026, 9, 5) }],
      '2026-09',
    );
    expect(o.gelir).toBe(0.37);
    expect(0.1 + 0.2 + 0.07).not.toBe(0.37); // düz toplama olsaydı tutmazdı
  });

  it('KURUŞ HASSASİYETİ: 1000 satır 0,01 tam 10,00 eder', () => {
    const odemeler = Array.from({ length: 1000 }, () => ({ amount: 0.01, paid_at: yerel(2026, 9, 2) }));
    const o = ayOzeti([], odemeler, '2026-09');
    expect(o.gelir).toBe(10);
    let duz = 0;
    for (let i = 0; i < 1000; i++) duz += 0.01;
    expect(duz).not.toBe(10); // düz toplama sapıyor; kuruş toplamı sapmıyor
  });

  it('KURUŞ HASSASİYETİ: net = gelir − gider kuruşta tam kalır', () => {
    const o = ayOzeti([gelir({ net_total: 1000.1 }), gider({ amount: 999.9 })], [], '2026-09');
    expect(o.net).toBe(0.2);
    expect(1000.1 - 999.9).not.toBe(0.2);
  });

  it('sayı metni olarak gelen tutarlar (numeric) doğru toplanır', () => {
    const o = ayOzeti([gelir({ net_total: '1250.50' }), gider({ amount: '0.25' })], [], '2026-09');
    expect(o.gelir).toBe(1250.5);
    expect(o.gider).toBe(0.25);
  });

  it('KDV/stopaj toplamı yalnız ayda GEÇERLİ kalemleri sayar — biten tekrarlı kalem sayılmaz', () => {
    const aktif = gelir({ vat_amount: 200, withholding_amount: 100 });
    const biten = gelir({
      vat_amount: 5000,
      withholding_amount: 2500,
      is_recurring: true,
      entry_date: '2026-01-01',
      recurring_until: '2026-03-31',
    });
    const o = ayOzeti([aktif, biten], [], '2026-09');
    expect(o.kayitlar).toEqual([aktif]);
    expect(o.kdvToplam).toBe(200);
    expect(o.stopajToplam).toBe(100);
  });

  it('KDV toplamı kuruş hassasiyetiyle toplanır', () => {
    const o = ayOzeti(
      [gelir({ vat_amount: 0.1 }), gelir({ vat_amount: 0.2 }), gelir({ vat_amount: 33.33 })],
      [],
      '2026-09',
    );
    expect(o.kdvToplam).toBe(33.63);
  });

  it('kalemler: gün ve tür her kayıt için üretilir (ana ekran sütunları bundan çizilir)', () => {
    const o = ayOzeti(
      [gelir({ entry_date: '2026-09-02', net_total: 100 }), gider({ entry_date: '2026-09-29', amount: 40 })],
      [{ amount: 10, paid_at: yerel(2026, 9, 15) }],
      '2026-09',
    );
    expect(o.kalemler).toHaveLength(3);
    expect(o.kalemler).toEqual(
      expect.arrayContaining([
        { tur: 'gelir', kurus: 10000, gun: 2 },
        { tur: 'gider', kurus: 4000, gun: 29 },
        { tur: 'gelir', kurus: 1000, gun: 15 },
      ]),
    );
  });

  it('boş girdide sıfırlar döner', () => {
    const o = ayOzeti([], [], '2026-09');
    expect(o).toMatchObject({ gelir: 0, gider: 0, net: 0, odemeToplam: 0, odemeAdet: 0, kdvToplam: 0, stopajToplam: 0 });
  });
});

describe('oranGecerliMi', () => {
  it('0–100 arası sayıyı kabul eder', () => {
    expect(oranGecerliMi(0)).toBe(true);
    expect(oranGecerliMi(20)).toBe(true);
    expect(oranGecerliMi(24.5)).toBe(true);
    expect(oranGecerliMi(100)).toBe(true);
  });

  it('NaN, negatif ve 100 üstünü reddeder (veritabanı CHECK sınırı 0–100)', () => {
    expect(oranGecerliMi(NaN)).toBe(false);
    expect(oranGecerliMi(-1)).toBe(false);
    expect(oranGecerliMi(100.01)).toBe(false);
    expect(oranGecerliMi(2000)).toBe(false);
    expect(oranGecerliMi(Infinity)).toBe(false);
  });
});
