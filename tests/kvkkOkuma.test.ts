import { describe, expect, it } from 'vitest';
import { SONA_GELME_PAYI, okumaOrani, sonaGelindiMi } from '../src/utils/kvkkOkuma';

// KVKK imza kapısının tek kuralı burada sınanıyor. Kapı yanlış kurulursa iki
// yönde de sessizce bozulur: ya herkesi geçirir (kapı sahte olur) ya da hiç
// kimseyi geçirmez (kayıt imkânsız olur). İkisi de ekranda görünmez.

const olcu = (offsetY: number, layoutHeight: number, contentHeight: number) => ({
  offsetY,
  layoutHeight,
  contentHeight,
});

describe('sonaGelindiMi', () => {
  it('ölçüm alınmadan (ilk çerçeve) sona gelinmiş SAYILMAZ', () => {
    expect(sonaGelindiMi(olcu(0, 0, 0))).toBe(false);
    expect(sonaGelindiMi(olcu(0, 0, 5000))).toBe(false);
  });

  it('metnin başındayken sona gelinmemiştir', () => {
    expect(sonaGelindiMi(olcu(0, 800, 5000))).toBe(false);
  });

  it('ortasındayken de sona gelinmemiştir', () => {
    expect(sonaGelindiMi(olcu(2000, 800, 5000))).toBe(false);
  });

  it('tam sona gelince doğrudur', () => {
    expect(sonaGelindiMi(olcu(4200, 800, 5000))).toBe(true);
  });

  it('payın içinde kalan birkaç piksel kullanıcıyı kapıda bırakmaz', () => {
    // 4200 tam son; 4180 ise 20 piksel eksik — ölçüm ondalığı yüzünden bu
    // fark cihazda oluşabiliyor ve kullanıcı sonsuza kadar takılırdı.
    expect(sonaGelindiMi(olcu(4180, 800, 5000))).toBe(true);
    expect(sonaGelindiMi(olcu(4200 - SONA_GELME_PAYI - 1, 800, 5000))).toBe(false);
  });

  it('metin ekrana sığıyorsa kaydırma beklenmez — şart sağlanmış sayılır', () => {
    // Kaydırma olayı hiç gelmeyeceği için burada `false` dönmek, düğmeyi
    // sonsuza kadar kilitlemek demekti.
    expect(sonaGelindiMi(olcu(0, 900, 700))).toBe(true);
    expect(sonaGelindiMi(olcu(0, 900, 900))).toBe(true);
  });

  it('zıplama (bounce) ile sınırın dışına taşan konum da sonu gösterir', () => {
    expect(sonaGelindiMi(olcu(4500, 800, 5000))).toBe(true);
  });
});

describe('okumaOrani', () => {
  it('ölçüm alınmadan sıfırdır', () => {
    expect(okumaOrani(olcu(0, 0, 5000))).toBe(0);
  });

  it('başta 0, ortada ~0.5, sonda 1', () => {
    expect(okumaOrani(olcu(0, 800, 4800))).toBe(0);
    expect(okumaOrani(olcu(2000, 800, 4800))).toBeCloseTo(0.5, 2);
    expect(okumaOrani(olcu(4000, 800, 4800))).toBe(1);
  });

  it('içerik ekrana sığıyorsa oran 1 — yoksa "%0 okundu" yazıp olmayan işe yollardık', () => {
    expect(okumaOrani(olcu(0, 900, 600))).toBe(1);
  });

  it('zıplama %100’ün üstüne çıkaramaz', () => {
    expect(okumaOrani(olcu(9999, 800, 4800))).toBe(1);
  });

  it('negatif konum (üstten zıplama) %0’ın altına inemez', () => {
    expect(okumaOrani(olcu(-120, 800, 4800))).toBe(0);
  });
});
