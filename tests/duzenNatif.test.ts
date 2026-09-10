import { describe, expect, it, vi } from 'vitest';

/**
 * GENİŞ EKRAN DÜZENİNİN NATİFTE KAPALI OLDUĞU.
 *
 * Ayrı dosya, çünkü Platform.OS modül taklidi dosya başına kurulur; aynı
 * dosyada hem 'web' hem 'ios' taklit edilemez. duzen.test.ts web'i, bu dosya
 * natifi sabitler.
 *
 * ÖNEMLİ: burada sınanan şey bir "ihtimal" değil. Ortalama iOS/Android'de
 * devreye girerse tablet ve katlanabilir telefonlarda içerik ekranın ortasına
 * sıkışır, iki yanı boş kalırdı — yani düzeltmenin kendisi natifte bir kusura
 * dönüşürdü.
 */
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const { genisEkranMi, ortalaStili, sutunSayisi } = await import('@/theme/duzen');

describe('natifte geniş ekran düzeni', () => {
  it('en geniş tablette bile devreye girmez', () => {
    expect(genisEkranMi(1366)).toBe(false); // iPad Pro yatay
    expect(genisEkranMi(3000)).toBe(false);
  });

  it('ortalama stili her genişlikte null döner — natif düzen aynen kalır', () => {
    expect(ortalaStili(1366)).toBeNull();
    expect(ortalaStili(3000, 'form')).toBeNull();
  });

  it('sütun sayısı her zaman 1', () => {
    expect(sutunSayisi(1366)).toBe(1);
    expect(sutunSayisi(3000, 200, 4)).toBe(1);
  });
});
