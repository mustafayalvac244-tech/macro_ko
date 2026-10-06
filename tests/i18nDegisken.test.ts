import { describe, expect, it } from 'vitest';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';
import { translate } from '@/i18n';

// 06.10.2026: 13 metin "{{ad}}" biçimindeydi; translate yalnız "{ad}" yerine
// koyduğu için ekranda "Okundu: {1 sa 30 dk}" gibi süslü parantez kalıyordu
// (zaman kaydı formu, toplu aktarım). Biçim tek: {ad}.
describe('çeviri değişkenleri', () => {
  it('hiçbir metin {{ad}} biçiminde değil', () => {
    const cift = [...Object.entries(tr), ...Object.entries(en)].filter(([, v]) => /\{\{/.test(v)).map(([k]) => k);
    expect(cift).toEqual([]);
  });

  it('değişken yerine konur, parantez kalmaz', () => {
    expect(translate('tr', 'time.durationRead', { sure: '1 sa 30 dk' })).toBe('Okundu: 1 sa 30 dk');
    expect(translate('tr', 'toplu.writing', { n: 3, toplam: 10 })).toBe('Aktarılıyor… 3/10');
    expect(translate('tr', 'wk.durusma', { n: '2' })).toBe('2 duruşma');
  });
});
