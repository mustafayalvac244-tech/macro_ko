import { describe, expect, it } from 'vitest';
import { beklemeSuresi, yenidenMs } from '../scripts/bekleme.mjs';

/**
 * Ücretsiz sağlayıcının tavanı kayan pencereyle yenileniyor: "bugün bitti"
 * değil, "yirmi üç dakika sonra devam". Bu ipucu okunmadığı için ölçüm
 * koşuları yarıda kesiliyordu.
 */
describe('yenidenMs', () => {
  it('saniyeyi milisaniyeye çevirir', () => {
    expect(yenidenMs('{"error":"daily_quota","yeniden":1357}')).toBe(1357000);
  });

  it('ipucu yoksa sıfır döner', () => {
    expect(yenidenMs('{"error":"daily_quota"}')).toBe(0);
    expect(yenidenMs('bozuk gövde')).toBe(0);
  });
});

describe('beklemeSuresi', () => {
  it('küçük payla bekler', () => {
    expect(beklemeSuresi('{"yeniden":60}')).toBe(65000);
  });

  it('üst sınırı aşmaz', () => {
    // Tek bir "üç saat sonra" cevabı, üst sınır olmadan ölçümü kilitlerdi.
    expect(beklemeSuresi('{"yeniden":10800}')).toBe(30 * 60 * 1000);
  });

  it('ipucu yoksa beklemez (çağıran kendi aralığını kullanır)', () => {
    expect(beklemeSuresi('{}')).toBe(0);
  });
});
