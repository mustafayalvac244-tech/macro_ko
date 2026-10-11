import { describe, expect, it } from 'vitest';
import { AAUT_DILIMLER, AAUT_MAKTU, DILIMLER_DOGRULANDI, TARIFE, aautHesapla } from '@/config/tarife';

/**
 * AAÜT — ÜÇÜNCÜ KISIM (nispi tarife) VE MAKTU ASGARİ ÜCRETLER.
 *
 * KAYNAK (10.10.2026): Resmî Gazete 4.11.2025 sayı 33067, Türkiye Barolar
 * Birliği tebliği "Avukatlık Asgari Ücret Tarifesi" EKİ
 * (https://www.resmigazete.gov.tr/eskiler/2025/11/20251104-9-1.pdf — 4 sayfa,
 * taranmış görüntü; tablolar GÖRÜNTÜDEN okundu). 8.1.2026 tarih ve 33131 sayılı
 * RG'deki değişiklik yalnız 10. maddenin ikinci fıkrasını kaldırıyor; hiçbir
 * tutar ya da oranı değiştirmiyor.
 *
 * ESKİ KUSUR: koddaki dilimler (400.000 / 800.000 / 1.600.000 …) resmî tabloyla
 * UYUŞMUYORDU. Resmî tablo: ilk 600.000 TL %16, sonra 600.000 TL %15, sonra
 * 1.200.000 TL %14, sonra 1.200.000 TL %13, sonra 1.800.000 TL %11, sonra
 * 2.400.000 TL %8, sonra 3.000.000 TL %5, sonra 3.600.000 TL %3, sonra
 * 4.200.000 TL %2, 18.600.000 TL'den yukarısı %1. Örnek: 1.000.000 TL için
 * kod 152.000 TL, resmî tablo 156.000 TL veriyordu.
 */

describe('aautHesapla — resmî nispi tablo', () => {
  it('dilim sınırları kümülatif olarak resmî tabloyla aynı', () => {
    expect(AAUT_DILIMLER.map((d) => d.upTo)).toEqual([
      600_000, 1_200_000, 2_400_000, 3_600_000, 5_400_000, 7_800_000, 10_800_000, 14_400_000, 18_600_000, Infinity,
    ]);
    expect(AAUT_DILIMLER.map((d) => d.rate)).toEqual([0.16, 0.15, 0.14, 0.13, 0.11, 0.08, 0.05, 0.03, 0.02, 0.01]);
  });

  it('1.000.000 TL: 600.000×%16 + 400.000×%15 = 156.000 TL', () => {
    expect(aautHesapla(1_000_000).ucret).toBeCloseTo(156_000, 2);
  });

  it('ilk dilim: 500.000 TL × %16 = 80.000 TL', () => {
    expect(aautHesapla(500_000).ucret).toBeCloseTo(80_000, 2);
  });

  it('dilim sınırında (600.000) ve bir kuruş üstünde süreklidir', () => {
    expect(aautHesapla(600_000).ucret).toBeCloseTo(96_000, 2);
    expect(aautHesapla(600_000.01).ucret).toBeCloseTo(96_000.0015, 4);
  });

  it('18.600.000 TL tam dilim toplamı = 1.242.000 TL; üstü %1', () => {
    expect(aautHesapla(18_600_000).ucret).toBeCloseTo(1_242_000, 2);
    expect(aautHesapla(20_000_000).ucret).toBeCloseTo(1_256_000, 2);
  });

  it('sıfır ve negatif tutarda ücret yok', () => {
    expect(aautHesapla(0).ucret).toBe(0);
    expect(aautHesapla(-5).ucret).toBe(0);
  });

  it('dilimler resmî metinden doğrulandı olarak işaretli', () => {
    expect(DILIMLER_DOGRULANDI).toBe(true);
  });
});

describe('AAUT_MAKTU — ikinci kısım ikinci bölüm (konusu para olmayan işler)', () => {
  it('resmî tablodaki tutarlarla birebir', () => {
    expect(AAUT_MAKTU.icraDairesi).toBe(9_000);
    expect(AAUT_MAKTU.sulhHukuk).toBe(30_000);
    expect(AAUT_MAKTU.asliye).toBe(45_000);
    expect(AAUT_MAKTU.tuketici).toBe(22_500);
    expect(AAUT_MAKTU.fikriSinai).toBe(55_000);
  });

  it('tarife kimliği kaynaklı', () => {
    expect(TARIFE.resmiGazete).toMatch(/33067/);
  });
});
