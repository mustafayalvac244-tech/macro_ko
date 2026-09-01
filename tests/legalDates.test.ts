import { describe, expect, it } from 'vitest';
import {
  computeLegalDue,
  isInJudicialRecess,
  isNonWorkingDay,
  recessRuleForGroup,
} from '@/utils/legalDates';

/**
 * Süre hesabı, uygulamadaki hata maliyeti EN YÜKSEK mantık: yanlış bir son gün
 * doğrudan hak kaybına yol açar. Beklenen değerler kanundan türetilir (HMK 92,
 * 93, 102, 104; CMK 331/4), koddan değil.
 *
 * 2026 takvimi (testlerde kullanılan günler):
 *   1 Oca Per · 5 Oca Pzt · 15 Oca Per · 17 Oca Cmt · 19 Oca Pzt
 *   28 Şub Cmt · 2 Mar Pzt · 23 Nis Per · 24 Nis Cum
 *   3 Eyl Per · 7 Eyl Pzt
 */
const d = (iso: string) => new Date(`${iso}T00:00:00`);
const ymd = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

describe('computeLegalDue — HMK 92 (sürenin hesaplanması)', () => {
  it('gün: tebliğ günü sayılmaz, süre N. günün sonunda biter', () => {
    // 5 Ocak tebliğ + 10 gün → 15 Ocak (tebliğ günü hesaba katılmaz).
    const r = computeLegalDue(d('2026-01-05'), 10, 'day');
    expect(ymd(r.raw)).toBe('2026-01-15');
    expect(ymd(r.due)).toBe('2026-01-15');
    expect(r.extended).toBe(false);
  });

  it('hafta: son haftanın aynı gününde biter', () => {
    // 5 Ocak Pazartesi + 2 hafta → 19 Ocak Pazartesi.
    const r = computeLegalDue(d('2026-01-05'), 2, 'week');
    expect(ymd(r.raw)).toBe('2026-01-19');
  });

  it('ay: hedef ay kısaysa o ayın son gününde biter (HMK 92/2)', () => {
    // 31 Ocak + 1 ay → 28 Şubat (2026 artık yıl değil).
    const r = computeLegalDue(d('2026-01-31'), 1, 'month');
    expect(ymd(r.raw)).toBe('2026-02-28');
  });

  it('yıl: ertesi yılın aynı gününde biter', () => {
    const r = computeLegalDue(d('2026-03-10'), 2, 'year');
    expect(ymd(r.raw)).toBe('2028-03-10');
  });
});

describe('computeLegalDue — HMK 93 (son günün tatile rastlaması)', () => {
  it('hafta sonuna denk gelen son gün ilk iş gününe kayar', () => {
    // 5 Ocak + 12 gün → 17 Ocak Cumartesi → 19 Ocak Pazartesi.
    const r = computeLegalDue(d('2026-01-05'), 12, 'day');
    expect(ymd(r.raw)).toBe('2026-01-17');
    expect(ymd(r.due)).toBe('2026-01-19');
    expect(r.extended).toBe(true);
  });

  it('resmî tatile denk gelen son gün kayar', () => {
    // 13 Nisan + 10 gün → 23 Nisan (Ulusal Egemenlik, Perşembe) → 24 Nisan Cuma.
    const r = computeLegalDue(d('2026-04-13'), 10, 'day');
    expect(ymd(r.raw)).toBe('2026-04-23');
    expect(ymd(r.due)).toBe('2026-04-24');
    expect(r.extended).toBe(true);
  });

  it('ay hesabında hafta sonuna düşen son gün de kayar', () => {
    // 31 Ocak + 1 ay → 28 Şubat Cumartesi → 2 Mart Pazartesi.
    const r = computeLegalDue(d('2026-01-31'), 1, 'month');
    expect(ymd(r.due)).toBe('2026-03-02');
  });
});

describe('computeLegalDue — adli tatil (HMK 102/104, CMK 331/4)', () => {
  it('hukukta: adli tatile düşen süre 31 Ağustos + 1 hafta olur', () => {
    // 1 Ağustos'ta biten süre adli tatil içindedir → 7 Eylül (Pazartesi).
    const r = computeLegalDue(d('2026-07-22'), 10, 'day', 'civil');
    expect(ymd(r.raw)).toBe('2026-08-01');
    expect(r.recessExtended).toBe(true);
    expect(ymd(r.due)).toBe('2026-09-07');
  });

  it('cezada: adli tatile düşen süre 31 Ağustos + 3 gün olur', () => {
    const r = computeLegalDue(d('2026-07-22'), 10, 'day', 'criminal');
    expect(r.recessExtended).toBe(true);
    expect(ymd(r.due)).toBe('2026-09-03');
  });

  it('icrada: adli tatil uzatması UYGULANMAZ', () => {
    // İcra daireleri tatilde de çalışır; yalnız hafta sonu kaydırması olur.
    const r = computeLegalDue(d('2026-07-22'), 10, 'day', 'none');
    expect(r.recessExtended).toBe(false);
    expect(ymd(r.due)).toBe('2026-08-03'); // 1 Ağu Cmt → 3 Ağu Pzt
  });

  it('adli tatil dışında biten süre uzatılmaz', () => {
    const r = computeLegalDue(d('2026-01-05'), 10, 'day', 'civil');
    expect(r.recessExtended).toBe(false);
    expect(ymd(r.due)).toBe('2026-01-15');
  });
});

describe('isInJudicialRecess — sınır günleri', () => {
  it('19 Temmuz tatil değil, 20 Temmuz tatildir', () => {
    expect(isInJudicialRecess(d('2026-07-19'))).toBe(false);
    expect(isInJudicialRecess(d('2026-07-20'))).toBe(true);
  });

  it('31 Ağustos tatil, 1 Eylül değildir', () => {
    expect(isInJudicialRecess(d('2026-08-31'))).toBe(true);
    expect(isInJudicialRecess(d('2026-09-01'))).toBe(false);
  });
});

describe('isNonWorkingDay', () => {
  it('hafta sonunu ve sabit resmî tatilleri tanır', () => {
    expect(isNonWorkingDay(d('2026-01-17'))).toBe(true); // Cumartesi
    expect(isNonWorkingDay(d('2026-01-18'))).toBe(true); // Pazar
    expect(isNonWorkingDay(d('2026-10-29'))).toBe(true); // Cumhuriyet Bayramı
    expect(isNonWorkingDay(d('2026-01-15'))).toBe(false); // Perşembe
  });
});

describe('recessRuleForGroup', () => {
  it('ceza 3 gün, icra muaf, diğerleri 1 hafta kuralına tabidir', () => {
    expect(recessRuleForGroup('ceza')).toBe('criminal');
    expect(recessRuleForGroup('icra')).toBe('none');
    expect(recessRuleForGroup('hukuk')).toBe('civil');
    expect(recessRuleForGroup('idare')).toBe('civil');
    expect(recessRuleForGroup('is')).toBe('civil');
  });
});

describe('dinî bayram uyarısı', () => {
  it('otomatik uzatmaz, yalnızca uyarır', () => {
    // 2026 Ramazan Bayramı 20–22 Mart. Son gün 20 Mart'a düşerse UZATILMAZ
    // (yıllara göre kaydığı için yanlış uzatma süre kaçırtır), uyarı verilir.
    const r = computeLegalDue(d('2026-03-10'), 10, 'day');
    expect(ymd(r.due)).toBe('2026-03-20');
    expect(r.religiousWarn).toBe(true);
  });
});
