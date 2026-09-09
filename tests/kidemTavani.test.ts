import { describe, expect, it } from 'vitest';
import { kidemBrutHesapla, tavanBul, KIDEM_TAVANLARI } from '@/config/kidemTavani';

/**
 * KIDEM TAZMİNATI TAVANI.
 *
 * Hesaplayıcı tavanı hiç uygulamıyordu; tavanın üstünde kazanan işçi için
 * ekrandaki rakam kanunen yanlış ve FAZLA çıkıyordu. Avukat bu rakamı
 * müvekkiline söylüyor — bu yüzden davranış teste bağlandı.
 *
 * Tavan yılda iki kez değişir ve ÇIKIŞ TARİHİNDEKİ dönem geçerlidir.
 */

describe('tavanBul — çıkış tarihine göre dönem', () => {
  it('Ocak-Haziran 2026 dönemini bulur', () => {
    expect(tavanBul(new Date(2026, 2, 15))?.tutar).toBe(64948.77); // 15 Mart 2026
  });

  it('Temmuz-Aralık 2026 dönemini bulur', () => {
    expect(tavanBul(new Date(2026, 8, 9))?.tutar).toBe(73729.87); // 9 Eylül 2026
  });

  it('dönem sınırlarını dahil sayar', () => {
    expect(tavanBul(new Date(2026, 5, 30))?.tutar).toBe(64948.77); // 30 Haziran
    expect(tavanBul(new Date(2026, 6, 1))?.tutar).toBe(73729.87); // 1 Temmuz
  });

  it('BİLİNMEYEN dönemde null döner (uydurmaz)', () => {
    // Sessizce eski tavanı kullanmak yanlış hesap üretirdi; bilmediğimizi
    // söylemek doğrusudur.
    expect(tavanBul(new Date(2027, 0, 15))).toBeNull();
    expect(tavanBul(new Date(2025, 5, 15))).toBeNull();
  });

  it('geçersiz tarihte çökmez', () => {
    expect(tavanBul(new Date('gecersiz'))).toBeNull();
  });
});

describe('kidemBrutHesapla — tavan uygulaması', () => {
  const eylul2026 = new Date(2026, 8, 9);

  it('tavanın ALTINDAKİ ücrette ücreti esas alır', () => {
    const r = kidemBrutHesapla(45000, 10, eylul2026);
    expect(r.esasUcret).toBe(45000);
    expect(r.brut).toBe(450000);
    expect(r.tavanUygulandi).toBe(false);
  });

  it('tavanın ÜSTÜNDEKİ ücrette tavanı esas alır (düzeltilen kusur)', () => {
    // Eski davranış: 200.000 × 10 = 2.000.000 ₺ (kanunen YANLIŞ)
    // Doğrusu:      73.729,87 × 10 = 737.298,70 ₺
    const r = kidemBrutHesapla(200000, 10, eylul2026);
    expect(r.esasUcret).toBe(73729.87);
    expect(r.brut).toBeCloseTo(737298.7, 2);
    expect(r.tavanUygulandi).toBe(true);
  });

  it('tam tavan tutarında tavanı "uygulandı" saymaz', () => {
    const r = kidemBrutHesapla(73729.87, 5, eylul2026);
    expect(r.tavanUygulandi).toBe(false);
    expect(r.esasUcret).toBe(73729.87);
  });

  it('çıkış tarihi ÖNCEKİ dönemdeyse o dönemin tavanını kullanır', () => {
    // Mart 2026'da çıkan için bugünün tavanı değil, o günkü tavan geçerli.
    const r = kidemBrutHesapla(200000, 10, new Date(2026, 2, 15));
    expect(r.esasUcret).toBe(64948.77);
    expect(r.brut).toBeCloseTo(649487.7, 2);
  });

  it('tavan bilinmiyorsa ücreti kullanır ama tavan null döner', () => {
    // Ekran bunu "tavan doğrulanamadı" diye göstermek zorundadır.
    const r = kidemBrutHesapla(200000, 10, new Date(2027, 0, 15));
    expect(r.tavan).toBeNull();
    expect(r.esasUcret).toBe(200000);
    expect(r.tavanUygulandi).toBe(false);
  });

  it('sıfır/negatif girdilerde sıfır döner', () => {
    expect(kidemBrutHesapla(0, 10, eylul2026).brut).toBe(0);
    expect(kidemBrutHesapla(50000, 0, eylul2026).brut).toBe(0);
    expect(kidemBrutHesapla(-5000, 10, eylul2026).brut).toBe(0);
  });
});

describe('KIDEM_TAVANLARI — tel kapan', () => {
  it('içinde bulunulan tarihi kapsayan bir dönem tanımlı olmalı', () => {
    const bugun = new Date();
    expect(
      tavanBul(bugun),
      'Kıdem tazminatı tavanı tablosu bugünü kapsamıyor. ' +
        'src/config/kidemTavani.ts içindeki KIDEM_TAVANLARI listesine yürürlükteki ' +
        'dönemi RESMÎ kaynaktan (csgb.gov.tr) ekleyin. Tahmini sayı yazmayın.'
    ).not.toBeNull();
  });

  it('dönemler tarih sırasında ve boşluksuz olmalı', () => {
    for (let i = 1; i < KIDEM_TAVANLARI.length; i++) {
      const oncekiBitis = new Date(`${KIDEM_TAVANLARI[i - 1]!.bitis}T00:00:00`);
      const buBaslangic = new Date(`${KIDEM_TAVANLARI[i]!.baslangic}T00:00:00`);
      const farkGun = (buBaslangic.getTime() - oncekiBitis.getTime()) / 86400000;
      expect(farkGun).toBe(1);
    }
  });
});
