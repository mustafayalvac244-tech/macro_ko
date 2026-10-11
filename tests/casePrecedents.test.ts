import { describe, expect, it } from 'vitest';
import { caseCourt, caseSearchTerm, emsalAramaYolu, emsalBaslikAnahtari, mahkemeParametresi } from '@/utils/emsalSecimi';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

/**
 * DOSYAYA-DUYARLI EMSAL.
 *
 * BULUNAN KUSUR: emsal her zaman Yargıtay'a soruluyordu. İdari bir davanın
 * temyiz mercii DANIŞTAY'dır; idare mahkemesindeki dosyaya Yargıtay kararı
 * göstermek yanlış yargı kolundan emsal göstermektir — o kararların o dosyada
 * hükmü yoktur.
 */
describe('caseCourt', () => {
  it('idari dosyada Danıştay sorar', () => {
    expect(caseCourt({ court_category: 'idare' })).toBe('danistay');
  });

  it('hukuk ve ceza dosyasında Yargıtay sorar', () => {
    expect(caseCourt({ court_category: 'hukuk' })).toBe('yargitay');
    expect(caseCourt({ court_category: 'ceza' })).toBe('yargitay');
  });

  it('kol bilinmiyorsa Yargıtay (dosyaların çoğunluğu adli yargıda)', () => {
    expect(caseCourt({ court_category: null })).toBe('yargitay');
    expect(caseCourt(null)).toBe('yargitay');
    expect(caseCourt(undefined)).toBe('yargitay');
  });
});

describe('caseSearchTerm', () => {
  it('dava türünü tercih eder', () => {
    expect(caseSearchTerm({ case_type: 'İşçilik Alacağı', title: 'Yılmaz v. X' })).toBe('İşçilik Alacağı');
  });

  it('tür yoksa başlıktan esas/karar numarasını ayıklar', () => {
    expect(caseSearchTerm({ case_type: null, title: 'Kira Tespiti E.2023/145' })).toBe('Kira Tespiti');
    expect(caseSearchTerm({ case_type: '', title: 'Tazminat 2023/145' })).toBe('Tazminat');
  });

  it('boş dosyada boş terim döner (arama tetiklenmez)', () => {
    expect(caseSearchTerm(null)).toBe('');
    expect(caseSearchTerm({ case_type: null, title: null })).toBe('');
  });
});

/**
 * DAVANA EMSAL KARTI — ETİKET VE HEDEF (09.10.2026 denetimi).
 *
 * BULUNAN KUSUR. İdari dosyada kart kararları Danıştay'dan getiriyordu ama
 * üstünde "… konusunda emsal Yargıtay kararları" yazıyordu; "Tümünü İçtihat'ta
 * gör" ve karar satırları da İçtihat ekranını YARGITAY'da açıyordu (ekran
 * ?q= ile gelince mahkemeyi sabit 'yargitay' yapıyordu). Avukat kartta
 * gördüğü Danıştay kararlarına dokununca Yargıtay sonuçlarına düşüyordu.
 */
describe('Davana Emsal kartı — etiket ve hedef dosyanın mahkemesine uyar', () => {
  it('idari dosyada başlık Danıştay der', () => {
    expect(emsalBaslikAnahtari('danistay')).toBe('dash.prec.forCaseDanistay');
    expect(emsalBaslikAnahtari('yargitay')).toBe('dash.prec.forCase');
  });

  it('"Tümünü gör" İçtihat ekranını aynı mahkemeyle açar', () => {
    expect(emsalAramaYolu('İmar para cezası', 'danistay')).toBe(
      '/ictihat?q=' + encodeURIComponent('İmar para cezası') + '&court=danistay',
    );
    // Yargıtay ekranın varsayılanı: yol eskisiyle aynı kalır.
    expect(emsalAramaYolu('Kira tespiti', 'yargitay')).toBe('/ictihat?q=Kira%20tespiti');
  });

  it('İçtihat ekranı ?court= parametresini yalnız bilinen iki mahkeme için kabul eder', () => {
    expect(mahkemeParametresi('danistay')).toBe('danistay');
    expect(mahkemeParametresi('yargitay')).toBe('yargitay');
    expect(mahkemeParametresi(undefined)).toBe('yargitay');
    expect(mahkemeParametresi('baska')).toBe('yargitay');
    expect(mahkemeParametresi(['danistay', 'x'])).toBe('yargitay');
  });

  it('metin iki dilde de mahkemeyi doğru söyler', () => {
    expect(tr['dash.prec.forCase']).toMatch(/Yargıtay/);
    expect((tr as Record<string, string>)['dash.prec.forCaseDanistay']).toMatch(/Danıştay/);
    expect((tr as Record<string, string>)['dash.prec.forCaseDanistay']).not.toMatch(/Yargıtay/);
    expect((en as Record<string, string>)['dash.prec.forCaseDanistay']).toMatch(/Council of State/);
  });
});
