import { describe, expect, it } from 'vitest';
import { duzeltmeOrani } from '../src/lib/duzeltmeOlcusu';

/**
 * Bu ölçü bir ÜST SINIRDIR, tam düzenleme mesafesi değil (gerekçe:
 * src/lib/duzeltmeOlcusu.ts — Levenshtein 6.000 karakterde telefonu dondurur).
 * Testler bunu hem doğruluyor hem de kısıtı KAYDA GEÇİRİYOR: sonraki oturum
 * "bu sayı neden büyük çıkmış" diye bakarken cevabı burada bulsun.
 */
describe('duzeltmeOrani', () => {
  it('hiç dokunulmadıysa 0', () => {
    expect(duzeltmeOrani('aynı metin', 'aynı metin')).toBe(0);
    expect(duzeltmeOrani('', '')).toBe(0);
  });

  it('tamamen değiştiyse 1', () => {
    expect(duzeltmeOrani('abc', 'xyz')).toBe(1);
    expect(duzeltmeOrani('bir şey', '')).toBe(1);
    expect(duzeltmeOrani('', 'bir şey')).toBe(1);
  });

  it('sondan ekleme yalnız eklenen kadar sayılır', () => {
    // 10 karakter + 10 karakter → yarısı değişti
    expect(duzeltmeOrani('0123456789', '0123456789abcdefghij')).toBe(0.5);
  });

  it('baştan ekleme de doğru ölçülür', () => {
    expect(duzeltmeOrani('0123456789', 'abcdefghij0123456789')).toBe(0.5);
  });

  it('ortadan tek bölge düzenlemesi doğru ölçülür', () => {
    // önek "AAAA", sonek "BBBB", ortadaki 2 karakter değişti (10 uzunlukta)
    expect(duzeltmeOrani('AAAAxxBBBB', 'AAAAyyBBBB')).toBe(0.2);
  });

  it('kısalan metinde önek/sonek çakışması oranı bozmaz', () => {
    // "aaa" → "aa": naif sonek sayımı aynı karakteri iki kez sayıp
    // negatif oran üretirdi. Sonuç 0 ile 1 arasında kalmalı.
    const o = duzeltmeOrani('aaa', 'aa');
    expect(o).toBeGreaterThanOrEqual(0);
    expect(o).toBeLessThanOrEqual(1);
  });

  it('DAĞINIK düzeltmeyi OLDUĞUNDAN BÜYÜK gösterir — bilinen kısıt', () => {
    // İlk ve son karakter değişti, ortadaki 8 karakter aynı kaldı.
    // Gerçekte %20 değişti; ortak önek ve sonek kalmadığı için ölçü 1 der.
    // Bu bir HATA DEĞİL, ölçünün tanımı — ve kıyas için yeterli, çünkü aynı
    // yanlılık bütün modlarda ve modellerde aynı.
    expect(duzeltmeOrani('X12345678Y', 'A12345678B')).toBe(1);
  });

  it('her zaman 0-1 aralığında ve üç haneye yuvarlı kalır', () => {
    const ornekler: Array<[string, string]> = [
      ['dilekçe metni burada uzun uzun', 'dilekçe metni burada kısa'],
      ['a'.repeat(1000), 'a'.repeat(999) + 'b'],
      ['Sayın Hâkimliğe', 'Sayın Mahkemeye'],
    ];
    for (const [a, b] of ornekler) {
      const o = duzeltmeOrani(a, b);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
      // numeric(4,3) sütununa sığmalı
      expect(Number(o.toFixed(3))).toBe(o);
    }
  });
});
