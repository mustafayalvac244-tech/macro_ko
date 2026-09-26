// Mağaza görsellerinde fiyat/"ücretsiz" ifadesi — Apple Guideline 2.3.7.
//
// 25.09.2026: Apple ikinci kez reddetti; sebeplerden biri görsel
// başlıklarında "Ücretsiz" ve "Yapay zekâ ayrı bir pakette" yazmasıydı.
// Fiyat bilgisi yalnız açıklama METNİNDE olabilir. Başlıklar
// scripts/magaza-pazarlama.mjs içinde üretiliyor; bu test o dosyanın
// YORUM DIŞI kısmında fiyat çağrıştıran bir kelime kalırsa düşer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const KOK = join(__dirname, '..');

function yorumsuz(kaynak: string): string {
  return kaynak
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((s) => s.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

describe('mağaza görsel başlıkları (Apple 2.3.7)', () => {
  const kod = yorumsuz(readFileSync(join(KOK, 'scripts/magaza-pazarlama.mjs'), 'utf8'));

  it.each([
    ['ücretsiz', /ücretsiz/i],
    ['free', /\bfree\b/i],
    ['fiyat', /fiyat/i],
    ['paket (fiyat katmanı imâsı)', /paket/i],
    ['premium', /premium/i],
    ['abonelik', /abonelik|subscription/i],
    ['deneme süresi', /deneme süresi|trial/i],
    // 26.09.2026: 'Uydurmayan yapay zekâ' mutlak doğruluk vaadiydi; terms m.6
    // yapay zekânın hata yapabileceğini söylüyor. Yanıltıcı reklam riski.
    ['mutlak doğruluk vaadi', /uydurma(yan|z)|hatasız|yanılmaz|%100/i],
  ])('başlıklarda "%s" yok', (_ad, desen) => {
    expect(kod.match(desen)?.[0] ?? null).toBeNull();
  });

  it('iPad kümesinde "Unmatched Route" hata görseli yok (04-takvim silindi)', () => {
    // 25.09.2026: magaza-pazarlama/ipad/04-takvim.png uygulama ekranı değil,
    // expo-router'ın "Unmatched Route" hata sayfasıydı. Geri gelmesin.
    const ipad = readFileSync(join(KOK, 'scripts/asc-vitrin.json'), 'utf8');
    expect(ipad).toContain('magaza-pazarlama/ipad');
    expect(() => readFileSync(join(KOK, 'magaza-pazarlama/ipad/04-takvim.png'))).toThrow();
  });
});
