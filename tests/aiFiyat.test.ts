import { describe, expect, it } from 'vitest';
import { AI_FIYAT, kacIslem } from '../src/config/aiFiyat';

/**
 * İş kuralı: her istekte bir birim sağlayıcıya gider, iki birim kâr kalır.
 * Fiyat tablosu bu kuraldan sapmamalı — sapma, ya zarar ettiğimiz ya da
 * kullanıcıdan fazla aldığımız anlamına gelir ve ikisi de sessizce olur.
 */
describe('AI_FIYAT', () => {
  it('her işlemde ücret, maliyetin üç katıdır (marj %66,7)', () => {
    for (const [tur, f] of Object.entries(AI_FIYAT)) {
      expect(Math.round(f.ucret * 100) / 100, tur).toBe(Math.round(f.maliyet * 3 * 100) / 100);
    }
  });

  it('mütalaa en pahalı işlemdir (çok adımlı, geniş besleme)', () => {
    const en = Math.max(...Object.values(AI_FIYAT).map((f) => f.ucret));
    expect(AI_FIYAT.mutalaa.ucret).toBe(en);
  });
});

describe('kacIslem', () => {
  it('paketin kaç dilekçeye yettiğini söyler', () => {
    // 100 TL / 5,70 = 17,54 → 17 dilekçe. Yukarı yuvarlamak, tutamayacağımız
    // bir söz vermek olurdu.
    expect(kacIslem(100, 'dilekce')).toBe(17);
  });

  it('yetmeyen bakiyede sıfır der', () => {
    expect(kacIslem(3, 'mutalaa')).toBe(0);
  });
});
