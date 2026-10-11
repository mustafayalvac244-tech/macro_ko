import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ANA EKRAN KULLANICININ YAZI BOYUTUNU EZMEZ (09.10.2026 denetimi).
 *
 * Ana ekranda 55 metin `allowFontScaling={false}` taşıyordu (+2 Resmî Gazete
 * kartında — kart yalnız ana ekranda çiziliyor): telefonda büyük yazı seçen
 * avukat (yaşlı kullanıcı, görme güçlüğü) ana ekranı küçük yazıyla görüyordu.
 * rn-ui-kit §6: "Kullanıcının sistem yazı boyutunu ezme". Başka ekranlara
 * dokunulmadı; bu bekçi yalnız bu iki dosyayı kapsar.
 */
const KOK = join(__dirname, '..');
const DOSYALAR = ['app/(app)/index.tsx', 'src/components/ResmiGazeteKarti.tsx'];

describe('ana ekran: sistem yazı boyutu', () => {
  it.each(DOSYALAR)('%s içinde allowFontScaling={false} yok', (yol) => {
    const satirlar = readFileSync(join(KOK, yol), 'utf8')
      .split('\n')
      .map((s, i) => [i + 1, s] as const)
      .filter(([, s]) => /allowFontScaling=\{false\}/.test(s))
      .map(([n]) => n);
    expect(satirlar).toEqual([]);
  });
});
