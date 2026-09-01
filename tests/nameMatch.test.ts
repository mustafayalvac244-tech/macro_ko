import { describe, expect, it } from 'vitest';
import { namesConflict, normalizeName } from '@/utils/nameMatch';

/**
 * Menfaat çatışması taraması: aynı kişinin karşı tarafta çıkmasını yakalar.
 * Yanlış NEGATİF (çatışmayı kaçırmak) meslekî risk doğurur; yanlış POZİTİF
 * yalnız gereksiz uyarı üretir. Bu yüzden eşleşme biraz geniş tutulur.
 */
describe('normalizeName', () => {
  it('Türkçe harflerde doğru küçültme yapar', () => {
    // 'I' Türkçede 'ı'ya iner; 'tr-TR' kullanılmasaydı 'i' olurdu.
    expect(normalizeName('IŞIK')).toBe('ışık');
    expect(normalizeName('İSTANBUL')).toBe('istanbul');
  });

  it('fazla boşlukları teke indirir', () => {
    expect(normalizeName('  Ahmet   Yılmaz ')).toBe('ahmet yılmaz');
  });
});

describe('namesConflict', () => {
  it('büyük/küçük harf ve boşluk farkına rağmen eşleşir', () => {
    expect(namesConflict('Ahmet Yılmaz', '  ahmet   yılmaz ')).toBe(true);
  });

  it('bir ad diğerinin içinde geçiyorsa çatışma sayar', () => {
    expect(namesConflict('Ahmet Yılmaz', 'Ahmet Yılmaz Ltd. Şti.')).toBe(true);
  });

  it('ilgisiz adları eşleştirmez', () => {
    expect(namesConflict('Ahmet Yılmaz', 'Mehmet Demir')).toBe(false);
  });

  it('çok kısa girdilerde eşleştirme yapmaz (gürültü önleme)', () => {
    expect(namesConflict('Al', 'Ali Veli')).toBe(false);
    expect(namesConflict('', 'Ahmet')).toBe(false);
  });

  it('kısa ama 3+ harfli ad, içerme kuralına takılmaz', () => {
    // 'ali' 5 harften kısa olduğu için içerme yoluyla eşleşmemeli.
    expect(namesConflict('ali', 'ali veli')).toBe(false);
  });
});
