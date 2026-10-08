import { describe, expect, it, vi } from 'vitest';

vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
const { inputDegeri, inputtanTarih } = await import('../src/components/ui/TarihSecici.web');

// Web'de topluluk tarih seçicisi null döndürüyordu; web karşılığı tarayıcının
// <input type=date|time|datetime-local> kutusu. Dönüşümler YEREL saatle olmalı:
// toISOString kullanılsaydı TR'de gece yarısına yakın günler bir önceki güne kayardı.
describe('web tarih seçici dönüşümleri', () => {
  it('tarih: yerel gün, saat korunur', () => {
    const once = new Date(2026, 9, 8, 0, 30);
    expect(inputDegeri(once, 'date')).toBe('2026-10-08');
    const d = inputtanTarih('2026-12-01', once, 'date')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 11, 1, 0, 30]);
  });

  it('saat: gün korunur', () => {
    const once = new Date(2026, 9, 8, 10, 0);
    expect(inputDegeri(once, 'time')).toBe('10:00');
    const d = inputtanTarih('14:45', once, 'time')!;
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([8, 14, 45]);
  });

  it('tarih-saat', () => {
    const d = inputtanTarih('2027-01-31T09:05', new Date(2026, 0, 1), 'datetime')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2027, 0, 31, 9, 5]);
    expect(inputDegeri(d, 'datetime')).toBe('2027-01-31T09:05');
  });

  it('boş/bozuk değer null (kutu temizlenince tarih uydurulmaz)', () => {
    expect(inputtanTarih('', new Date(), 'date')).toBeNull();
    expect(inputtanTarih('abc', new Date(), 'time')).toBeNull();
  });
});
