import { describe, expect, it } from 'vitest';
import { computeKapak } from '@/utils/kapak';

/**
 * GÜNCEL KAPAK HESABI — icra dosyasında avukatın dayandığı para hesabı.
 *
 * Bu motorun hiç testi yoktu. Yanlış bir kapak, karşı tarafa fazla ya da eksik
 * tutar bildirmek demektir; ikisi de mesleki sorumluluk doğurur. Beklenen
 * değerler ELDE hesaplandı (koddan türetilmedi) ve İİK 138'in sırasına
 * dayanıyor: önce masraf + vekalet ücreti, sonra işlemiş faiz, en son asıl
 * alacak.
 *
 * Faiz basit (adi) faizdir ve YALNIZ asıl alacak üzerinden işler — birikmiş
 * faize faiz yürütmek (bileşik faiz) hukuka aykırı olurdu.
 */

const dosya = (o: Partial<Parameters<typeof computeKapak>[0]> = {}) => ({
  principal: 100000,
  pre_interest: 0,
  interest_rate: 36,
  start_date: '2026-01-01',
  expenses: 5000,
  attorney_fee: 10000,
  ...o,
});

describe('computeKapak — takip çıkışı', () => {
  it('asıl + işlemiş faiz + masraf + vekalet ücretini toplar', () => {
    const r = computeKapak(dosya({ pre_interest: 2500 }), [], new Date('2026-01-01T00:00:00'));
    // 100.000 + 2.500 + 5.000 + 10.000
    expect(r.takipCikisi).toBe(117500);
  });
});

describe('computeKapak — faiz', () => {
  it('gün bazında basit faiz işletir (181 gün, %36)', () => {
    // 100.000 × 0,36 × 181/365 = 17.852,05
    const r = computeKapak(dosya(), [], new Date('2026-07-01T00:00:00'));
    expect(r.accruedInterest).toBeCloseTo(17852.05, 2);
    // Kalan = masraf 15.000 + faiz 17.852,05 + asıl 100.000
    expect(r.remaining).toBeCloseTo(132852.05, 2);
  });

  it('takip günü faiz işlememiştir', () => {
    const r = computeKapak(dosya(), [], new Date('2026-01-01T00:00:00'));
    expect(r.accruedInterest).toBe(0);
    expect(r.remaining).toBe(115000);
  });

  it('faiz oranı sıfırsa faiz yürütmez', () => {
    const r = computeKapak(dosya({ interest_rate: 0 }), [], new Date('2026-12-31T00:00:00'));
    expect(r.accruedInterest).toBe(0);
  });

  it('birikmiş faize faiz yürütmez (bileşik faiz yok)', () => {
    // pre_interest 50.000 eklenince faiz DEĞİŞMEMELİ: faiz yalnız asıl alacaktan.
    const faizsiz = computeKapak(dosya(), [], new Date('2026-07-01T00:00:00'));
    const onFaizli = computeKapak(dosya({ pre_interest: 50000 }), [], new Date('2026-07-01T00:00:00'));
    expect(onFaizli.accruedInterest).toBeCloseTo(faizsiz.accruedInterest, 2);
  });
});

describe('computeKapak — İİK 138 dağıtım sırası', () => {
  it('önce masraf ve vekalet ücretini kapatır', () => {
    // Faizi sıfırlayıp yalnız dağıtımı ölçüyoruz. Masraf+vekalet = 15.000.
    const r = computeKapak(
      dosya({ interest_rate: 0 }),
      [{ amount: 12000, collected_at: '2026-02-01' }],
      new Date('2026-03-01T00:00:00')
    );
    expect(r.remainingExpenses).toBe(3000); // 15.000 − 12.000
    expect(r.remainingPrincipal).toBe(100000); // asıl alacağa hiç dokunulmadı
  });

  it('masraf bittikten sonra asıl alacağa geçer', () => {
    const r = computeKapak(
      dosya({ interest_rate: 0 }),
      [{ amount: 20000, collected_at: '2026-02-01' }],
      new Date('2026-03-01T00:00:00')
    );
    expect(r.remainingExpenses).toBe(0);
    expect(r.remainingPrincipal).toBe(95000); // 20.000 − 15.000 masraf = 5.000
  });

  it('asıl alacaktan ÖNCE faizi kapatır', () => {
    // pre_interest 8.000; ödeme 20.000 → 15.000 masraf, 5.000 faize.
    const r = computeKapak(
      dosya({ interest_rate: 0, pre_interest: 8000 }),
      [{ amount: 20000, collected_at: '2026-02-01' }],
      new Date('2026-03-01T00:00:00')
    );
    expect(r.remainingExpenses).toBe(0);
    expect(r.remainingInterest).toBe(3000); // 8.000 − 5.000
    expect(r.remainingPrincipal).toBe(100000); // asıl alacak henüz el değmemiş
  });

  it('asıl alacak azalınca sonraki dönemde faiz de azalır', () => {
    const odemesiz = computeKapak(dosya(), [], new Date('2026-07-01T00:00:00'));
    const odemeli = computeKapak(
      dosya(),
      [{ amount: 65000, collected_at: '2026-01-01' }], // 15.000 masraf + 50.000 asıl
      new Date('2026-07-01T00:00:00')
    );
    expect(odemeli.remainingPrincipal).toBe(50000);
    // Asıl yarıya indiği için işleyen faiz de yaklaşık yarı olmalı.
    expect(odemeli.accruedInterest).toBeCloseTo(odemesiz.accruedInterest / 2, 1);
  });
});

describe('computeKapak — sınır durumlar', () => {
  it('borcu aşan tahsilatta kalan sıfırın altına inmez', () => {
    const r = computeKapak(
      dosya({ interest_rate: 0 }),
      [{ amount: 500000, collected_at: '2026-02-01' }],
      new Date('2026-03-01T00:00:00')
    );
    expect(r.remaining).toBe(0);
    expect(r.remainingPrincipal).toBe(0);
    expect(r.remainingExpenses).toBe(0);
  });

  it('tahsilatları tarih sırasına koyar (girdi sırası önemsiz)', () => {
    const odemeler = [
      { amount: 10000, collected_at: '2026-05-01' },
      { amount: 10000, collected_at: '2026-02-01' },
    ];
    const a = computeKapak(dosya(), odemeler, new Date('2026-07-01T00:00:00'));
    const b = computeKapak(dosya(), [...odemeler].reverse(), new Date('2026-07-01T00:00:00'));
    expect(a.remaining).toBeCloseTo(b.remaining, 2);
  });

  it('toplam tahsilatı doğru bildirir', () => {
    const r = computeKapak(
      dosya(),
      [
        { amount: 10000, collected_at: '2026-02-01' },
        { amount: 7500, collected_at: '2026-05-01' },
      ],
      new Date('2026-07-01T00:00:00')
    );
    expect(r.collected).toBe(17500);
  });

  it('geçersiz takip tarihinde çökmez', () => {
    const r = computeKapak(dosya({ start_date: 'gecersiz' }), [], new Date('2026-07-01T00:00:00'));
    expect(Number.isFinite(r.remaining)).toBe(true);
  });
});
