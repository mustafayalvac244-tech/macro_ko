import { describe, expect, it } from 'vitest';
import { haftaBasi, haftaYuku } from '@/lib/haftaYuku';

// Yerel saatle kurulur: ayrım cihazın yerel gününe göre yapılıyor.
const yerel = (y: number, a: number, g: number, s = 10) => new Date(y, a - 1, g, s, 0, 0);

describe('Bu Hafta grafiği', () => {
  it('hafta pazartesi başlar; pazar günü önceki pazartesiye döner', () => {
    expect(haftaBasi(yerel(2026, 10, 6)).getDate()).toBe(5); // salı → 5 Ekim pazartesi
    expect(haftaBasi(yerel(2026, 10, 11)).getDate()).toBe(5); // pazar → aynı hafta
    expect(haftaBasi(yerel(2026, 10, 12)).getDate()).toBe(12); // pazartesi → kendisi
  });

  it('günlere doğru dağıtır, hafta dışını saymaz, bugünü işaretler', () => {
    const simdi = yerel(2026, 10, 6, 15);
    const g = haftaYuku(
      [
        { scheduled_at: yerel(2026, 10, 5, 9).toISOString() },
        { scheduled_at: yerel(2026, 10, 6, 11).toISOString() },
        { scheduled_at: yerel(2026, 10, 6, 14).toISOString() },
        { scheduled_at: yerel(2026, 10, 13, 9).toISOString() }, // gelecek hafta
        { scheduled_at: 'bozuk' },
      ],
      [
        { due_at: yerel(2026, 10, 11, 23).toISOString() },
        { due_at: yerel(2026, 10, 4, 23).toISOString() }, // geçen hafta pazar
      ],
      simdi,
    );
    expect(g).toHaveLength(7);
    expect(g.map((x) => x.durusma)).toEqual([1, 2, 0, 0, 0, 0, 0]);
    expect(g.map((x) => x.sure)).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(g.filter((x) => x.bugun).map((x) => x.sira)).toEqual([1]);
    expect(g[0].tarih).toBe('2026-10-05');
  });
});
