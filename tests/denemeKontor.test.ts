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
    // Deneme bayrağından sonra yalnız önbellek ölçümü (03.10.2026) gelebilir.
    for (const c of cagrilar) expect(c, c).toMatch(/!!cfg\.denemeLimit(?:, \w+)?\)\s*;$/);
  });

  it('ücret deneme bayrağında sıfır', () => {
    expect(kod).toMatch(/const ucret = cost > 0 && !deneme \?/);
  });
});

describe('yedek modelin cevabı hak saymaz', () => {
  it('aylık ve günlük çağrı sayacı musteriyeYaz bayrağına bakıyor', () => {
    const govde = kod.slice(kod.indexOf('async function recordUsage('), kod.indexOf('const SYSTEM_PROMPT ='));
    // 09.10.2026: iki satır (aylık + günlük) tek deyimli eklemeyle (göç 0191)
    // AYNI artışı alıyor; artıştaki çağrı musteriyeYaz'a bağlı.
    expect(govde).toMatch(/const artis = \{ calls: musteriyeYaz \? 1 : 0,/);
    const eklemeler = govde.match(/await kullanimEkle\(s, userId, [\w()]+, artis\);/g) ?? [];
    expect(eklemeler.length).toBe(2);
  });
});

describe('deneme isteğinde düşünme kapalı', () => {
  // 01.10.2026 canlıda ölçüldü: denemenin 3.000 token'lık dilekçe tavanını
  // Sonnet'in düşünmesi yedi, metin boş döndü, istek yedek modele düştü.
  it('her ucretliChat çağrısı deneme bayrağıyla düşünmeyi kapatıyor', () => {
    const cagrilar = kod.match(/await ucretliChat\([^;]*\);/g) ?? [];
    expect(cagrilar.length).toBeGreaterThanOrEqual(5);
    // Deneme bayrağı düşünme argümanıdır; ardından (04.10.2026'dan beri)
    // isteğe bağlı EK BELGE argümanı gelebilir.
    // Ya deneme bayrağı ya da DÜŞÜNME HİÇ YOK (false — mütalaa, 04.10.2026:
    // süre sınırı). İkisi de denemede düşünmeyi kapatır.
    for (const c of cagrilar) expect(c, c).toMatch(/,\s*(?:!cfg\.denemeLimit|false)\s*(?:\)\s*;$|,)/);
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

describe('aramalar ve denetimler paralel (04.10.2026)', () => {
  // Ölçüm: sohbetin ~20 sn'si, dilekçenin ~38 sn'si modelden bağımsızdı ve
  // aramalar SIRAYLA yapılıyordu; mütalaa bu yüzden 150 sn sınırına çarptı.
  it('hiçbir arama ya da madde denetimi tek başına beklenmez', () => {
    expect(kod).not.toMatch(/await (buildRules|buildMevzuat|buildGrounding|uydurmaMaddeDenetimi)\(/);
    expect((kod.match(/Promise\.all\(\[\s*buildRules\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
