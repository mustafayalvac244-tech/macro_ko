import { describe, expect, it, vi } from 'vitest';

/**
 * GENİŞ EKRAN DÜZENİ.
 *
 * BULUNAN KUSUR: uygulama telefon düzeniyle yazıldı, web'de o düzen ekranın
 * tamamına esnetiliyordu — 1900 px'lik masaüstünde tek kart 1870 px, giriş
 * formunun e-posta kutusu ekranın bir ucundan diğerine uzuyordu.
 *
 * BU TESTİN VARLIK SEBEBİ: düzeltmenin NATİFİ BOZMAMASI şart. Telefonda
 * hiçbir şey değişmemeli; ortalama yalnız web + geniş ekranda devreye girmeli.
 * Aşağıdaki testler Platform.OS'u iki yönde de taklit ederek bunu sabitler.
 */

// react-native'in tamamı vitest (node) ortamında yüklenemez; yalnız Platform
// gerekiyor, o yüzden modül taklit ediliyor. Varsayılan: web.
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

const { genisEkranMi, ortalaStili, sutunSayisi, SUTUN_GENISLIKLERI, GENIS_ESIK } = await import('@/theme/duzen');

describe('genisEkranMi', () => {
  it('eşiğin altında geniş sayılmaz', () => {
    expect(genisEkranMi(GENIS_ESIK - 1)).toBe(false);
    expect(genisEkranMi(390)).toBe(false); // tipik telefon
  });

  it('eşik ve üstünde geniş sayılır', () => {
    expect(genisEkranMi(GENIS_ESIK)).toBe(true);
    expect(genisEkranMi(1920)).toBe(true);
  });
});

describe('ortalaStili', () => {
  it('dar ekranda null döner — dizideki null öge stil eklemez', () => {
    expect(ortalaStili(390)).toBeNull();
    expect(ortalaStili(1023, 'form')).toBeNull();
  });

  it('geniş ekranda sütunu ortalar ve üst sınır koyar', () => {
    expect(ortalaStili(1920)).toEqual({
      width: '100%',
      maxWidth: SUTUN_GENISLIKLERI.genis,
      alignSelf: 'center',
    });
  });

  it('form sütunu panodan belirgin biçimde dardır', () => {
    // Giriş formunun e-posta kutusu pano genişliğinde olmamalı.
    expect(SUTUN_GENISLIKLERI.form).toBeLessThan(SUTUN_GENISLIKLERI.dar);
    expect(SUTUN_GENISLIKLERI.dar).toBeLessThan(SUTUN_GENISLIKLERI.genis);
    expect(ortalaStili(1920, 'form')?.maxWidth).toBe(SUTUN_GENISLIKLERI.form);
    expect(ortalaStili(1920, 'dar')?.maxWidth).toBe(SUTUN_GENISLIKLERI.dar);
  });

  it('sütun asla pencereden geniş görünmez (width %100 sınırlar)', () => {
    const s = ortalaStili(1100);
    expect(s?.width).toBe('100%');
  });
});

describe('sutunSayisi', () => {
  it('dar ekranda her zaman tek sütun', () => {
    expect(sutunSayisi(390)).toBe(1);
    expect(sutunSayisi(1023)).toBe(1);
  });

  it('geniş ekranda ikiye çıkar ama üst sınırı aşmaz', () => {
    expect(sutunSayisi(1920)).toBe(2);
    expect(sutunSayisi(1920, 340, 3)).toBe(3);
  });

  it('kart en az genişliği büyükse sütun sayısı düşer', () => {
    // 1180'lik sütuna 700 px'lik iki kart sığmaz.
    expect(sutunSayisi(1920, 700)).toBe(1);
  });
});
