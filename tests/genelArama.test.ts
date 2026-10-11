import { describe, expect, it } from 'vitest';
import { sonuclariBirlestir } from '@/utils/genelArama';

/**
 * Genel arama: hata "sonuç yok" olarak gösterilmemeli (app/search.tsx, 23. denetim ajanı).
 */
describe('sonuclariBirlestir', () => {
  it('üç sorgu da başarılıysa sonuçları döndürür; null veri boş listedir', () => {
    const r = sonuclariBirlestir<{ id: string }, { id: string }, { id: string }>(
      { data: [{ id: 'd1' }], error: null },
      { data: null, error: null },
      { data: [], error: null }
    );
    expect(r).toEqual({ cases: [{ id: 'd1' }], clients: [], documents: [] });
  });

  it('herhangi bir sorgu hata verirse FIRLATIR (eskiden boş liste dönüp "sonuç bulunamadı" görünüyordu)', () => {
    const ag = { message: 'Failed to fetch' };
    expect(() =>
      sonuclariBirlestir({ data: [{ id: 'd1' }], error: null }, { data: null, error: ag }, { data: [], error: null })
    ).toThrow();
    // hatayı olduğu gibi iletir (react-query error durumuna düşsün)
    try {
      sonuclariBirlestir({ data: null, error: ag }, { data: [], error: null }, { data: [], error: null });
      expect.unreachable();
    } catch (e) {
      expect(e).toBe(ag);
    }
  });

  it('diğer sorgular başarılı olsa bile tek hata aramayı hata sayar', () => {
    expect(() =>
      sonuclariBirlestir({ data: [{ id: 'd1' }], error: null }, { data: [{ id: 'c1' }], error: null }, { data: null, error: new Error('rls') })
    ).toThrow('rls');
  });
});
