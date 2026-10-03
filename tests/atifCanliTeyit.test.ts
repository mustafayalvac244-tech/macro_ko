// Canlı künye teyidi — 03.10.2026.
//
// OLAY: gerçek kullanıcı dilekçeye içtihat istedi; model iki künye yazdı, ikisi
// de havuzda yoktu; avukat aynı künyeyi İçtihat Arama'da da bulamadı (arama
// o sırada 6 kez 502 verdi). Bu test üç şeyi korur:
//  1. Havuzda olmayan künye CANLI kaynakta aranıyor ve üç sonuç ayrı tutuluyor
//     (doğrulandı-uyap / canlıda yok / ulaşılamadı → havuzda yok).
//  2. "Canlıda yok" künye, dilekçe/mütalaa/belgede hakkı düşürmeyen kusurlu
//     çıktı sayılıyor ve ekranda kırmızı gösteriliyor (tr + en).
//  3. Künye araması Emsal düşünce Bedesten'le devam ediyor; 502 sebebi loglanıyor.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kunyeNormalize } from '../supabase/functions/_shared/kunyeBicim';

const KOK = join(__dirname, '..');
const oku = (p: string) => readFileSync(join(KOK, p), 'utf8');
const aiChat = oku('supabase/functions/ai-chat/index.ts');
const ictihat = oku('supabase/functions/ictihat/index.ts');

describe('canlı künye teyidi', () => {
  it('künye biçimi iki tarafta aynı (öndeki sıfır ve boşluk atılır)', () => {
    expect(kunyeNormalize('2019/01234')).toBe('2019/1234');
    expect(kunyeNormalize(' 2019 / 1234 ')).toBe('2019/1234');
    expect(kunyeNormalize('')).toBe('');
  });

  it('denetim sonucu canlidaYok alanı taşıyor ve kaynağı ayırıyor', () => {
    expect(aiChat).toMatch(/canlidaYok: string\[\];/);
    expect(aiChat).toMatch(/kaynak\?: 'havuz' \| 'uyap'/);
    expect(aiChat).toContain('canliKunyeDogrula(esas, karar)');
    expect(aiChat).toMatch(/if \(r === null\) return;[\s\S]*kaynak: 'uyap'[\s\S]*canlidaYok\.push/);
    expect(aiChat).toContain("a.mahkeme === '' || a.mahkeme === 'Yargıtay'");
  });

  it('canlıda olmayan künye dilekçe, mütalaa ve belgede hak düşürmez', () => {
    const n = (aiChat.match(/\(kararDenetimi\?\.canlidaYok\.length \?\? 0\) > 0/g) ?? []).length;
    expect(n).toBeGreaterThanOrEqual(3);
  });

  it('dilekçe ve mütalaa istemi dosyada olmayan künyeyi yasaklıyor', () => {
    expect(aiChat).toContain('yalnız aşağıdaki DOSYADA listelenen kararlara');
    expect(aiChat).toContain('[emsal karar: İçtihat Arama ekranından ekleyin]');
    expect(aiChat).toContain('[emsal karar: İçtihat Arama ile ekleyin]');
  });

  it('ölçüm sayaçları göçte ve kayıtta var', () => {
    const goc = oku('supabase/migrations/0167_atif_canli_teyit.sql');
    expect(goc).toContain('canli_dogrulanan');
    expect(goc).toContain('canlida_yok');
    expect(aiChat).toContain('canlida_yok: kararDenetimi?.canlidaYok.length ?? 0');
  });

  it("ekran kırmızı bloğu gösteriyor, metinler tr ve en'de", () => {
    const ui = oku('src/components/ui/AtifDenetimi.tsx');
    expect(ui).toContain("t('atif.canlidaYokBaslik')");
    expect(ui).toContain("t('atif.kaynakUyap')");
    for (const dil of ['tr', 'en']) {
      const s = oku(`src/i18n/${dil}.ts`);
      for (const k of ['atif.canlidaYokBaslik', 'atif.canlidaYokNot', 'atif.kaynakUyap']) {
        expect(s, `${dil}: ${k}`).toContain(`'${k}':`);
      }
    }
  });

  it('künye araması Emsal düşünce Bedesten ile sürüyor; 502 sebebi loglanıyor', () => {
    expect(ictihat).toMatch(/emsalDustu = true;[\s\S]*console\.error\('kunye: emsal araması düştü:'/);
    expect(ictihat).toContain("if (emsalDustu && collected.length === 0) throw new Error('source_unreachable');");
    expect(ictihat).toContain("console.error('ictihat 502:'");
  });
});
