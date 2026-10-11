import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

// 10.10.2026 denetim bulguları (erişilebilirlik + çeviri kalanları).
const KOK = join(__dirname, '..');

function dosyalar(dir: string): string[] {
  return readdirSync(dir).flatMap((ad) => {
    const yol = join(dir, ad);
    return statSync(yol).isDirectory() ? dosyalar(yol) : /\.tsx?$/.test(ad) ? [yol] : [];
  });
}
const kaynak = (yol: string) => readFileSync(join(KOK, yol), 'utf8');
const gor = (yol: string) => yol.slice(KOK.length + 1);

describe('arayüz metin ve erişilebilirlik bekçisi', () => {
  it('savaş planı "AI aktif" satırı OpenAI anahtarı iddia etmez (anahtar istenmiyor)', () => {
    for (const k of ['plan.aiOn', 'plan.aiFailed'] as const) {
      for (const [dil, sozluk] of [['tr', tr], ['en', en]] as const) {
        expect(sozluk[k], `${dil}:${k}`).not.toMatch(/openai|anahtar|\bkey\b|credit|bakiye/i);
      }
    }
  });

  it('allowFontScaling={false} yalnız marka açılış perdesinde (kullanıcının yazı boyutu ezilmez)', () => {
    const ihlal = [...dosyalar(join(KOK, 'app')), ...dosyalar(join(KOK, 'src'))]
      .filter((y) => /allowFontScaling=\{false\}/.test(readFileSync(y, 'utf8')))
      .map(gor)
      .filter((y) => !y.endsWith('LaunchIntro.tsx'));
    expect(ihlal).toEqual([]);
  });

  it('ErrorBoundary çıplak renk kodu içermez (tema token\'ından boyanır)', () => {
    expect(kaynak('src/components/ErrorBoundary.tsx')).not.toMatch(/#[0-9A-Fa-f]{3,8}\b|rgba?\(/);
  });

  it('sözleşme / profil / icra formlarında sabit (i18n\'siz) placeholder yok', () => {
    const ihlal: string[] = [];
    for (const yol of ['app/contract.tsx', 'app/profile-form.tsx', 'app/enforcement-form.tsx']) {
      for (const m of kaynak(yol).matchAll(/placeholder="([^"]*)"/g)) {
        if (!/^[0-9x ]+$/.test(m[1]!) && /[A-Za-zğüşıöçĞÜŞİÖÇ]{3,}/.test(m[1]!)) ihlal.push(`${yol}: ${m[1]}`);
      }
    }
    expect(ihlal).toEqual([]);
  });

  it('yalnız-ikon başlık/FAB/göz düğmelerinin erişilebilirlik adı i18n\'den gelir', () => {
    expect(kaynak('src/components/ui/ScreenHeader.tsx').match(/accessibilityLabel=/g)?.length).toBeGreaterThanOrEqual(4);
    expect(kaynak('src/components/ui/FAB.tsx')).toMatch(/accessibilityLabel=/);
    const input = kaynak('src/components/ui/Input.tsx');
    expect(input).not.toMatch(/accessibilityLabel=\{[^}]*'Şifreyi/);
    expect(input).toMatch(/t\('input\.hidePassword'\)/);
  });
});
