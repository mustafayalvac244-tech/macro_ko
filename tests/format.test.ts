import { describe, expect, it } from 'vitest';
import { formatFileSize, formatMoney, initials, titleCase } from '@/utils/format';

describe('formatMoney', () => {
  it('binlik ayırıcı nokta, kuruş virgül kullanır (Türkçe biçim)', () => {
    expect(formatMoney(1234567.89)).toBe('₺1.234.567,89');
    expect(formatMoney(1000)).toBe('₺1.000');
  });

  it('kuruş sıfırsa gösterilmez', () => {
    expect(formatMoney(1500)).toBe('₺1.500');
    expect(formatMoney(0)).toBe('₺0');
  });

  it('kuruş varsa iki hane gösterir', () => {
    expect(formatMoney(0.5)).toBe('₺0,50');
    expect(formatMoney(99.9)).toBe('₺99,90');
  });

  it('negatif tutarı korur', () => {
    expect(formatMoney(-2500)).toBe('₺-2.500');
  });

  /** Eksik/bozuk veride ekranda "₺NaN" görünmemeli. */
  it('geçersiz sayıda ₺0 döner', () => {
    expect(formatMoney(NaN)).toBe('₺0');
    expect(formatMoney(Infinity)).toBe('₺0');
    expect(formatMoney(undefined as unknown as number)).toBe('₺0');
  });
});

describe('formatFileSize', () => {
  it('birimi büyüklüğe göre seçer', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('GB üstünde birim taşmaz', () => {
    expect(formatFileSize(5 * 1024 ** 4)).toMatch(/GB$/);
  });
});

describe('initials', () => {
  it('ad ve soyadın ilk harflerini alır', () => {
    expect(initials('Ahmet Yılmaz')).toBe('AY');
    expect(initials('Ayşe Fatma Demir')).toBe('AD'); // ilk + son
  });

  it('tek kelimede ilk iki harfi alır', () => {
    expect(initials('Ahmet')).toBe('AH');
  });

  it('fazla boşlukları yok sayar', () => {
    expect(initials('  Ahmet   Yılmaz  ')).toBe('AY');
  });

  it('boş adda çökmez', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});

describe('titleCase', () => {
  it('alt çizgiyi boşluğa çevirip baş harfleri büyütür', () => {
    expect(titleCase('court_order')).toBe('Court Order');
    expect(titleCase('pleading')).toBe('Pleading');
  });

  it('boş girdide çökmez', () => {
    expect(titleCase('')).toBe('');
  });
});
