// Deneme sorusu kontörden DÜŞMEZ — 01.10.2026 canlıda ölçüldü: ücretsiz deneme
// sorusu test hesabının kontör bakiyesini -1,07 TL yaptı (ai_kontor_dus bakiyeyi
// eksiye indiriyor; "sıfır bakiyede sessizce başarısız olur" varsayımı yanlıştı).
//
// Korunan: ai-chat'teki HER recordUsage çağrısı deneme bayrağını geçiyor ve
// ücret hesabı bu bayrakta sıfır. Yeni bir mod eklenip bayrak unutulursa düşer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const kod = readFileSync(join(__dirname, '..', 'supabase/functions/ai-chat/index.ts'), 'utf8');

describe('deneme sorusu kontörden düşmez', () => {
  it('her recordUsage çağrısı deneme bayrağını geçiyor', () => {
    const cagrilar = kod.match(/await recordUsage\([^;]*\);/g) ?? [];
    expect(cagrilar.length).toBeGreaterThanOrEqual(5);
    for (const c of cagrilar) expect(c, c).toMatch(/!!cfg\.denemeLimit\)\s*;$/);
  });

  it('ücret deneme bayrağında sıfır', () => {
    expect(kod).toMatch(/const ucret = cost > 0 && !deneme \?/);
  });
});

describe('yedek modelin cevabı hak saymaz', () => {
  it('aylık ve günlük çağrı sayacı musteriyeYaz bayrağına bakıyor', () => {
    const govde = kod.slice(kod.indexOf('async function recordUsage('), kod.indexOf('const SYSTEM_PROMPT ='));
    const sayaclar = govde.match(/calls: \(\w+\?\.calls \?\? 0\) \+ [^,]+,/g) ?? [];
    expect(sayaclar.length).toBe(2);
    for (const c of sayaclar) expect(c, c).toContain('(musteriyeYaz ? 1 : 0)');
  });
});

describe('deneme isteğinde düşünme kapalı', () => {
  // 01.10.2026 canlıda ölçüldü: denemenin 3.000 token'lık dilekçe tavanını
  // Sonnet'in düşünmesi yedi, metin boş döndü, istek yedek modele düştü.
  it('her ucretliChat çağrısı deneme bayrağıyla düşünmeyi kapatıyor', () => {
    const cagrilar = kod.match(/await ucretliChat\([^;]*\);/g) ?? [];
    expect(cagrilar.length).toBeGreaterThanOrEqual(5);
    for (const c of cagrilar) expect(c, c).toMatch(/!cfg\.denemeLimit\)\s*;$/);
    expect(kod).toMatch(/\.\.\.dusunmeAyari\(model, dusunme\)/);
  });
});

describe('dilekçe yarım kalmaz', () => {
  // 01.10.2026 ölçüldü: deneme dilekçesi 3.000 token tavanda kesildi.
  // Ürün sahibi: "token sınırı 6000 olsun", "yarım kalma ihtimali olmasın".
  it('dilekçe tavanı en az 6.000', () => {
    expect(kod).toMatch(/const dilekceMaxTok = Math\.max\(cfg\.maxOut, 6000\);/);
  });
  it('tavan dolunca (max_tokens) kaldığı yerden devam ediliyor', () => {
    const govde = kod.slice(kod.indexOf('async function claudeChat('), kod.indexOf('async function ucretliChat('));
    expect(govde).toMatch(/stop_reason !== 'max_tokens'/);
    expect(govde).toMatch(/text \+= parca/);
  });
});
