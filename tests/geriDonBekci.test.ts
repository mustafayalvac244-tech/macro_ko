import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Web'de yenilemeden sonra yığında tek ekran kalır ve router.back() hiçbir şey
// yapmaz: geri oku ölü kalıyor, kaydedilen form kapanmıyor, ikinci basış çift
// kayıt açıyordu (08.10.2026). Ekranlar src/lib/geriDon kullanır.
const KOK = join(__dirname, '..');
const dosyalar = (d: string): string[] =>
  readdirSync(d).flatMap((a) => {
    const y = join(d, a);
    return statSync(y).isDirectory() ? dosyalar(y) : /\.tsx?$/.test(a) ? [y] : [];
  });

describe('geri bekçisi', () => {
  it('app/ ve src/components altında çıplak router.back() yok', () => {
    const ihlal = [...dosyalar(join(KOK, 'app')), ...dosyalar(join(KOK, 'src/components'))]
      .filter((y) => !y.endsWith('ErrorBoundary.tsx')) // canGoBack ile korunuyor
      .filter((y) => /router\.back\(\)/.test(readFileSync(y, 'utf8')))
      .map((y) => y.slice(KOK.length + 1));
    expect(ihlal).toEqual([]);
  });
});
