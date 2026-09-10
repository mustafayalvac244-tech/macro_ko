import { describe, expect, it } from 'vitest';
import { caseCourt, caseSearchTerm } from '@/utils/emsalSecimi';

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
