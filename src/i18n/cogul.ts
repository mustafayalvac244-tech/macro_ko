/**
 * İNGİLİZCE ÇOĞUL — `{n:day|days}` sözdizimi.
 *
 * NEDEN VAR (10.10.2026, denetim bulgusu): en.ts'te sayıdan sonra çoğul isim
 * SABİT yazılıydı ('{n} days'); süre rozeti 1 gün kala "1 days", panoda
 * "1 hearings" gösteriyordu. Türkçede sayıdan sonra isim çoğullanmaz, bu yüzden
 * sorun yalnız İngilizce sözlüğünde.
 *
 * KULLANIM: `'{n} {n:day|days} left'`. Değişken tam olarak 1 ise ilk seçenek,
 * değilse (0, 2, 2.5 …) ikincisi. Değişken verilmediyse çoğul seçilir.
 * Seçeneklerde boşluk olabilir: `{n:entry has|entries have}`.
 */
const COGUL = /\{(\w+):([^|{}]*)\|([^|{}]*)\}/g;

export function cogulUygula(metin: string, vars?: Record<string, string | number>): string {
  return metin.replace(COGUL, (_tam, ad: string, tekil: string, cogul: string) => {
    const deger = vars?.[ad];
    return deger !== undefined && Number(deger) === 1 ? tekil : cogul;
  });
}
