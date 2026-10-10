import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mulgaMi } from '@/data/laws/mulga';

/**
 * MÜLGA MADDE ROZETİ (23. denetim ajanı, 10.10.2026).
 *
 * Havuzdaki yürürlükten kalkmış maddeler ekranda sıradan madde gibi duruyordu.
 * Daha kötüsü: eski ayıklayıcı 29 mülga maddenin metnine BAŞKA bir maddenin
 * başlığını yazmıştı (İşK m.83 → "İçki veya uyuşturucu madde kullanma yasağı"),
 * ve HMK m.107 (belirsiz alacak davası) hâlâ canlı madde gibiydi — oysa resmî
 * kaynakta 16/7/2026 tarihli ve 7589 sayılı Kanun'un 19. maddesiyle mülga.
 */
describe('mulgaMi', () => {
  it('"(Mülga: …)" işaretli kısa gövde mülgadır', () => {
    expect(mulgaMi({ text: '(Mülga: 2/7/2012-6352/105 md.)' })).toBe(true);
    expect(mulgaMi({ text: '(Mülga:16/7/2026-7589/19 md.)' })).toBe(true);
  });

  it('önünde "(Değişik: …)" notu olan mülga (Anayasa m.145) da mülgadır', () => {
    expect(mulgaMi({ text: '(Değişik: 12/9/2010-5982/15 md.) (Mülga: 16/4/2017-6771/16 md.)' })).toBe(true);
  });

  it('gövde yalnız "Mülga" ise (eski ayıklayıcının bıraktığı) mülgadır', () => {
    expect(mulgaMi({ text: 'Mülga' })).toBe(true);
    expect(mulgaMi({ text: ' mülga. ' })).toBe(true);
  });

  it('arkasına sonraki maddenin başlığı sızmış kısa artık mülgalığı bozmaz', () => {
    expect(mulgaMi({ text: '(Mülga: 24/4/2001-4650/21 md.) Dava hakkı' })).toBe(true);
  });

  it('canlı madde mülga SAYILMAZ', () => {
    expect(mulgaMi({ text: '(1) Mahkemelerin görevi, ancak kanunla düzenlenir.' })).toBe(false);
    // "Mülga" sözcüğüyle başlayan ama canlı hüküm (İşK Geçici m.4)
    expect(mulgaMi({ text: 'Mülga 3008 sayılı İş Kanununun 13 üncü maddesi hükümleri haklarında uygulanmayanlar için, bu Kanunun geçici 6 ncı maddesinde sözü edilen kıdem tazminatı hakkı 12.8.1967 tarihinden itibaren başlar.' })).toBe(false);
    expect(mulgaMi({ text: '' })).toBe(false);
  });

  it('kısmi mülgalık (fıkra/cümle) maddeyi mülga yapmaz — madde yürürlüktedir', () => {
    expect(mulgaMi({ text: '(Mülga fıkra: 1/1/2020-1234/5 md.) (1) Bu madde kapsamında yapılan işlemler geçerlidir.' })).toBe(false);
    expect(mulgaMi({ text: '(Mülga: 12/9/2010-5982/6 md.) (1) Yeni hüküm metni burada başlar ve devam eder.' })).toBe(false);
  });
});

describe('havuzdaki mülga maddeler', () => {
  interface Madde {
    no: string;
    text: string;
    title?: string;
  }
  const oku = (slug: string): Madde[] =>
    (JSON.parse(readFileSync(fileURLToPath(new URL(`../src/data/laws/${slug}.json`, import.meta.url)), 'utf-8')) as {
      articles: Madde[];
    }).articles;

  // Eski ayıklayıcı bu maddelerin metnine başka maddenin başlığını yazmıştı;
  // gerçek metin resmî kaynaktaki "(Mülga: …)" işaretidir.
  const ESKI_YANLIS: Array<[string, string[]]> = [
    ['hmk', ['107']],
    ['turk-ceza', ['18', '222']],
    ['turk-medeni', ['660', '661', '662', '664']],
    ['ttk', ['349', '351', '428', '458', '469', '524', '525', '526', '628']],
    ['is-kanunu', ['65', '77', '78', '79', '80', '81', '83', '84', '85', '86', '89', '95', '105']],
  ];
  for (const [slug, nolar] of ESKI_YANLIS) {
    it(`${slug}: ${nolar.join(', ')} mülga olarak tanınır ve metni işarettir`, () => {
      const k = oku(slug);
      for (const no of nolar) {
        const m = k.find((a) => a.no === no);
        expect(m, `${slug} m.${no}`).toBeDefined();
        expect(m?.text, `${slug} m.${no} metni`).toMatch(/^\(Mülga\s*:\s*[^)]*\)$/);
        expect(mulgaMi(m!), `${slug} m.${no} rozet`).toBe(true);
      }
    });
  }

  it('yeni eklenen mülga maddeler de tanınır (TMK 659, TTK 148, İşK 82)', () => {
    for (const [slug, no] of [['turk-medeni', '659'], ['ttk', '148'], ['is-kanunu', '82']] as const) {
      const m = oku(slug).find((a) => a.no === no);
      expect(m && mulgaMi(m), `${slug} m.${no}`).toBe(true);
    }
  });

  it('canlı maddeler mülga sayılmaz (TCK 217/A, HMK 102, İşK Geçici 4)', () => {
    for (const [slug, no] of [['turk-ceza', '217/A'], ['hmk', '102'], ['is-kanunu', 'Geçici 4']] as const) {
      const m = oku(slug).find((a) => a.no === no);
      expect(m && mulgaMi(m), `${slug} m.${no}`).toBe(false);
    }
  });
});
