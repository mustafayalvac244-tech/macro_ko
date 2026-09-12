import { describe, expect, it } from 'vitest';
import { ParaButcesi } from '../scripts/istek.mjs';

/**
 * PARA BÜTÇESİ.
 *
 * Bu sınıfın var olma sebebi somut bir kayıp: 11 Eylül 2026'da 5 dolarlık API
 * kredisi tek bir ölçüm koşusunda tükendi. O sırada bütçe yalnız DUVAR SAATİNİ
 * sayıyordu ve rapor her koşuda "₺0,00" yazıyordu — çünkü sunucu kullanım
 * bilgisi göndermediğinde künye onu SIFIR kabul ediyordu.
 *
 * Testlerin yarısı bu yüzden "bilinmeyen maliyet sıfır sayılmasın" diyor:
 * sıfırla karıştırılan bir bilinmeyen, harcamayı görünmez yapar.
 */
describe('ParaButcesi', () => {
  it('maliyeti toplar', () => {
    const b = new ParaButcesi(10, 3);
    b.gor({ maliyetTL: 2, girdiToken: 100, ciktiToken: 50 });
    b.gor({ maliyetTL: 3, girdiToken: 100, ciktiToken: 50 });
    expect(b.harcanan).toBe(5);
    expect(b.bilinmeyen).toBe(0);
  });

  it('kullanım bilgisi gelmezse SIFIR saymaz, BİLİNMİYOR sayar', () => {
    // 11 Eylül'deki körlük tam buydu: sunucu kullanım döndürmeyince rapor
    // "₺0,00" yazıyordu ve harcama yokmuş gibi görünüyordu.
    const b = new ParaButcesi(10, 3);
    b.gor(null);
    b.gor(undefined);
    b.gor({ model: 'claude-opus-5' } as unknown as { maliyetTL?: number });
    expect(b.harcanan).toBe(0);
    expect(b.bilinmeyen).toBe(3);
    expect(b.satir()).toContain('BİLİNMİYOR');
  });

  it('token varken maliyet 0 ise bu GERÇEK sıfırdır', () => {
    // Ücretsiz katmanda maliyet gerçekten sıfırdır; onu "bilinmiyor" saymak
    // ters yönde yanlış olur ve ücretsiz koşuyu boş yere durdururdu.
    const b = new ParaButcesi(10, 2);
    b.gor({ maliyetTL: 0, girdiToken: 800, ciktiToken: 400 });
    expect(b.bilinmeyen).toBe(0);
    expect(b.harcanan).toBe(0);
  });

  it('tavan aşılınca dolar', () => {
    const b = new ParaButcesi(5, 10);
    b.gor({ maliyetTL: 4.9, girdiToken: 1, ciktiToken: 1 });
    expect(b.doldu()).toBe(false);
    b.gor({ maliyetTL: 0.2, girdiToken: 1, ciktiToken: 1 });
    expect(b.doldu()).toBe(true);
  });

  it('tavan verilmezse asla dolmaz', () => {
    const b = new ParaButcesi(0, 10);
    b.gor({ maliyetTL: 9999, girdiToken: 1, ciktiToken: 1 });
    expect(b.doldu()).toBe(false);
    expect(b.satir()).toContain('sınırsız');
  });

  it('ön yoklama: ilk senaryodan tüm koşuyu öngörür ve tavanı aşacaksa söyler', () => {
    // 11 senaryoluk koşu, ilk senaryo ₺3 → öngörü ₺33, tavan ₺10 → aşar.
    const b = new ParaButcesi(10, 11);
    b.gor({ maliyetTL: 3, girdiToken: 1000, ciktiToken: 500 });
    const o = b.ongoru();
    expect(o).not.toBeNull();
    expect(o!.ongoru).toBeCloseTo(33, 5);
    expect(o!.asar).toBe(true);
  });

  it('ön yoklama: tavana sığıyorsa aşmaz', () => {
    const b = new ParaButcesi(50, 11);
    b.gor({ maliyetTL: 3, girdiToken: 1000, ciktiToken: 500 });
    expect(b.ongoru()!.asar).toBe(false);
  });

  it('ön yoklama, maliyet hiç görülmediyse null döner', () => {
    // Öngörüyü sıfır maliyetten kurmak, "bedava" diye yanlış bir güven verirdi.
    const b = new ParaButcesi(10, 11);
    b.gor(null);
    expect(b.ongoru()).toBeNull();
  });

  it('ön yoklamada bilinmeyen istekler ortalamayı düşürmez', () => {
    // İki istek görüldü, biri bilinmiyor: ortalama BİLİNEN tek istek üzerinden
    // kurulmalı. Aksi hâlde ortalama yarıya iner ve öngörü olduğundan ucuz çıkar.
    const b = new ParaButcesi(100, 10);
    b.gor({ maliyetTL: 4, girdiToken: 10, ciktiToken: 10 });
    b.gor(null);
    expect(b.ongoru()!.ongoru).toBeCloseTo(40, 5);
  });
});
