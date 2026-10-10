import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { translate } from '@/i18n';
import { cogulUygula } from '@/i18n/cogul';

// 10.10.2026 denetim bulgusu: en.ts'te sayıdan sonra çoğul isim sabit yazılıydı;
// süre rozeti 1 gün kala "1 days", panoda "1 hearings" gösteriyordu.
// Türkçede sayıdan sonra isim çoğullanmaz; sorun yalnız İngilizce sözlüğünde.
describe('İngilizce çoğul', () => {
  it('cogulUygula: 1 → tekil, diğerleri → çoğul, değişken yoksa çoğul', () => {
    expect(cogulUygula('{n} {n:day|days}', { n: 1 })).toBe('{n} day');
    expect(cogulUygula('{n} {n:day|days}', { n: '1' })).toBe('{n} day');
    expect(cogulUygula('{n} {n:day|days}', { n: 0 })).toBe('{n} days');
    expect(cogulUygula('{n} {n:day|days}', { n: 2 })).toBe('{n} days');
    expect(cogulUygula('{n} {n:day|days}')).toBe('{n} days');
    expect(cogulUygula('{adet} {adet:entry has|entries have} no rate', { adet: 1 })).toBe('{adet} entry has no rate');
  });

  it('süre rozeti ve pano: 1 gün / 1 duruşma tekil okunur', () => {
    expect(translate('en', 'dash.upcoming.days', { n: 1 })).toBe('1 day');
    expect(translate('en', 'dash.upcoming.days', { n: 3 })).toBe('3 days');
    expect(translate('en', 'dash.focus.inDays', { n: 1 })).toBe('1 day left');
    expect(translate('en', 'dash.nHearings', { n: 1 })).toBe('1 hearing');
    expect(translate('en', 'time.missingRate', { adet: 1 })).toContain('1 entry has no hourly rate');
    expect(translate('en', 'dash.outcome.descMore', { n: 1 })).toContain('1 more hearing is waiting');
    expect(translate('en', 'ai.errQuotaWait', { dk: '1' })).toContain('about 1 minute.');
  });

  it('tüm İngilizce metinlerde değişkenler 1 iken "1 <çoğul isim>" kalmaz', () => {
    // Sayısı hiçbir zaman 1 olamayan metinler: sabit plan sınırları, sabit üst
    // sınırlar, yalnız ürün sahibinin gördüğü yönetici ekranı.
    const sayisiHepsiCogul = new Set<string>([
      'auth.pricingInfoBody',
      'plan.doldu.dava',
      'plan.doldu.muvekkil',
      'plan.doldu.belge',
      'premium.f.freeLimits',
      'premium.f.aiQuota',
      'ek.turler',
      'ek.hata.taranmisUzun',
      'admin.pushReach',
      'admin.pushSent',
      'admin.atifRow',
    ]);
    const isimler =
      'days|hours|minutes|weeks|months|items|cases|clients|files|records|messages|hearings|tasks|users|decisions|rulings|articles|members|rows|pages|entries|dates|installments|devices|documents|citations|questions';
    const kotu = new RegExp(`(^|[^0-9.,])1 (${isimler})\\b`, 'i');
    const bulunan: string[] = [];
    for (const [anahtar, metin] of Object.entries(en)) {
      if (sayisiHepsiCogul.has(anahtar)) continue;
      const vars: Record<string, number> = {};
      for (const m of metin.matchAll(/\{(\w+)(?::[^|{}]*\|[^|{}]*)?\}/g)) vars[m[1]!] = 1;
      const cikti = translate('en', anahtar as never, vars);
      if (kotu.test(cikti)) bulunan.push(`${anahtar}: ${cikti}`);
    }
    expect(bulunan).toEqual([]);
  });
});
