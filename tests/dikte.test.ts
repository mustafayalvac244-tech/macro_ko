import { describe, expect, it } from 'vitest';
import { dikteEkle } from '@/utils/dikte';

describe('dikteEkle', () => {
  it('boş metne parçayı yazar', () => {
    expect(dikteEkle('', ' kira alacağı ')).toBe('kira alacağı');
    expect(dikteEkle('   ', 'x')).toBe('x');
  });
  it('araya tek boşluk koyar', () => {
    expect(dikteEkle('Müvekkil', 'kiracıdır')).toBe('Müvekkil kiracıdır');
    expect(dikteEkle('Müvekkil\n', 'kiracıdır')).toBe('Müvekkil\nkiracıdır');
  });
  it('boş parça metni değiştirmez', () => {
    expect(dikteEkle('a', '  ')).toBe('a');
  });
});
