import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// BEKÇİ (08.10.2026). Tutar kutuları ekran ekran elle ayrıştırılıyordu ve iki
// zıt hata vardı: "her nokta binliktir" (1250.5 → 12505, taksit 333.33 →
// 33333) ve "yalnız virgül ondalıktır" ("10.000" → 10). Hepsi tek, testli
// ayrıştırıcıya (src/utils/tutar.ts) bağlandı. Bu test, aynı kalıp bir ekrana
// yeniden yazılırsa düşer. Bkz. tests/tutar.test.ts.

const KOK = join(__dirname, '..');
const YASAK: Array<[RegExp, string]> = [
  [/\.replace\(\/\\\.\/g,\s*''\)/, "noktayı binlik sayıp silmek: replace(/\\./g, '')"],
  [/Number\([^()]*\.replace\(',',\s*'\.'\)\)/, "yalnız virgülü ondalık saymak: Number(x.replace(',', '.'))"],
  [/Number\([^()]*\.replace\(\/\[\^\\d\]\/g,\s*''\)\)/, "rakam dışını silmek: Number(x.replace(/[^\\d]/g, ''))"],
];

function dosyalar(dizin: string): string[] {
  const sonuc: string[] = [];
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) sonuc.push(...dosyalar(yol));
    else if (/\.(tsx?|jsx?)$/.test(ad)) sonuc.push(yol);
  }
  return sonuc;
}

describe('tutar ayrıştırma bekçisi', () => {
  it('ekranlar tutarı elle ayrıştırmaz (utils/tutar kullanılır)', () => {
    const ihlaller: string[] = [];
    for (const yol of [...dosyalar(join(KOK, 'app')), ...dosyalar(join(KOK, 'src/components'))]) {
      const satirlar = readFileSync(yol, 'utf8').split('\n');
      satirlar.forEach((satir, i) => {
        for (const [kalip, ad] of YASAK) {
          if (kalip.test(satir)) ihlaller.push(`${yol.slice(KOK.length + 1)}:${i + 1} — ${ad}`);
        }
      });
    }
    expect(ihlaller).toEqual([]);
  });
});
