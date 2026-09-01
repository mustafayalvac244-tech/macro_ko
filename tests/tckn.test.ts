import { describe, expect, it } from 'vitest';
import { isValidTCKN } from '@/utils/tckn';

/**
 * Numaralar SENTETİKTİR: algoritmayla üretilmiş, gerçek bir kişiye ait değildir.
 * Doğrulama yalnız biçimsel geçerliliği ölçer (NVİ sorgusu yapılmaz).
 */
describe('isValidTCKN', () => {
  it('algoritmaya uyan numaraları kabul eder', () => {
    expect(isValidTCKN('12345678950')).toBe(true);
    expect(isValidTCKN('10000000078')).toBe(true);
    expect(isValidTCKN('98765432150')).toBe(true);
  });

  it('10. hane (kontrol hanesi) yanlışsa reddeder', () => {
    expect(isValidTCKN('12345678960')).toBe(false);
  });

  it('11. hane (toplam kontrolü) yanlışsa reddeder', () => {
    expect(isValidTCKN('12345678951')).toBe(false);
  });

  it('sıfırla başlayan numarayı reddeder', () => {
    expect(isValidTCKN('01234567890')).toBe(false);
  });

  it('uzunluğu 11 olmayanı reddeder', () => {
    expect(isValidTCKN('1234567895')).toBe(false);
    expect(isValidTCKN('123456789500')).toBe(false);
    expect(isValidTCKN('')).toBe(false);
  });

  it('rakam dışı karakter içereni reddeder', () => {
    expect(isValidTCKN('1234567895a')).toBe(false);
    expect(isValidTCKN('12345 78950')).toBe(false);
  });

  it('baştaki/sondaki boşlukları yok sayar', () => {
    expect(isValidTCKN('  12345678950  ')).toBe(true);
  });

  it('null/undefined girdide çökmez', () => {
    expect(isValidTCKN(undefined as unknown as string)).toBe(false);
    expect(isValidTCKN(null as unknown as string)).toBe(false);
  });
});
