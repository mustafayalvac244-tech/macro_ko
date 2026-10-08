import { describe, expect, it } from 'vitest';
import { LEGAL_DEADLINES } from '../src/constants/legalDeadlines';
import { computeLegalDue, recessRuleForGroup } from '../src/utils/legalDates';
import { istinafSonGunu, istinafTanimi } from '../src/utils/istinafSuresi';

// Dosya detayı istinaf süresini eskiden kendi içinde sabit tutuyordu (ceza 7 gün,
// idare 'civil' tatil kuralı) ve süre kataloğuyla çelişiyordu. Artık katalogdan okur.
const gun = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('istinaf son günü — süre kataloğuyla aynı', () => {
  it('kategori → katalog girdisi', () => {
    expect(istinafTanimi('hukuk').id).toBe('istinaf-hukuk');
    expect(istinafTanimi(null).id).toBe('istinaf-hukuk');
    expect(istinafTanimi('ceza').id).toBe('istinaf-ceza');
    expect(istinafTanimi('idare').id).toBe('idari-istinaf');
    expect(istinafTanimi('idare').rule).toBe('idari');
    expect(istinafTanimi('ceza').rule).toBe('criminal');
  });

  it('ceza: tebliğ 05.01.2026 → 19.01.2026 (eskiden ekran 12.01 veriyordu)', () => {
    expect(gun(istinafSonGunu(new Date(2026, 0, 5), 'ceza'))).toBe('2026-01-19');
  });

  it.each(['hukuk', 'ceza', 'idare'] as const)('%s: her gün için katalog hesabıyla aynı', (k) => {
    const def = LEGAL_DEADLINES.find((d) => d.id === istinafTanimi(k).id)!;
    for (let i = 0; i < 366; i++) {
      const teblig = new Date(2026, 0, 1 + i);
      const beklenen = computeLegalDue(teblig, def.amount, def.unit, recessRuleForGroup(def.group)).due;
      expect(gun(istinafSonGunu(teblig, k))).toBe(gun(beklenen));
    }
  });

  it('saat 17:00', () => {
    const d = istinafSonGunu(new Date(2026, 2, 2), 'hukuk');
    expect([d.getHours(), d.getMinutes()]).toEqual([17, 0]);
  });
});
