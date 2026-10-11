import { describe, expect, it } from 'vitest';
import { SAYFA_BOYU, tumSayfalar } from '../src/utils/sayfalama';

/**
 * PostgREST tek yanıtta en çok `max_rows` satır döndürür (Supabase CLI
 * yapılandırma belgesi: `api.max_rows`, varsayılan 1000). Tavanı aşan sorgu
 * hata vermez, sessizce kısa döner. Dava dizini tek sorguyla çekiliyordu.
 * Sahte sunucu bu davranışı taklit eder.
 */
function sahteSunucu(toplam: number, tavan: number, sayiVer = true) {
  const satirlar = Array.from({ length: toplam }, (_, i) => ({ id: i }));
  const istekler: Array<[number, number]> = [];
  const getir = async (bas: number, son: number) => {
    istekler.push([bas, son]);
    const adet = Math.max(0, Math.min(son - bas + 1, tavan));
    return { data: satirlar.slice(bas, bas + adet), error: null, count: sayiVer ? toplam : null };
  };
  return { getir, istekler };
}

describe('tumSayfalar', () => {
  it('sunucu tavanını aşan liste eksiksiz gelir (2.500 satır, tavan 1.000)', async () => {
    const s = sahteSunucu(2500, 1000);
    const satirlar = await tumSayfalar(s.getir);
    expect(satirlar).toHaveLength(2500);
    expect(new Set(satirlar.map((r) => r.id)).size).toBe(2500);
    expect(s.istekler).toHaveLength(3);
  });

  it('sunucu tavanı sayfa boyundan küçükse de eksik kalmaz (panelde 500 yapılmışsa)', async () => {
    const s = sahteSunucu(1200, 500);
    const satirlar = await tumSayfalar(s.getir);
    expect(satirlar.map((r) => r.id)).toEqual(Array.from({ length: 1200 }, (_, i) => i));
  });

  it('küçük listede tek istek atılır (boş sayfa için ikinci istek yok)', async () => {
    const s = sahteSunucu(37, 1000);
    expect(await tumSayfalar(s.getir)).toHaveLength(37);
    expect(s.istekler).toEqual([[0, SAYFA_BOYU - 1]]);
  });

  it('tam sayfa boyu kadar satırda da toplam bilindiği için fazladan istek yok', async () => {
    const s = sahteSunucu(1000, 1000);
    expect(await tumSayfalar(s.getir)).toHaveLength(1000);
    expect(s.istekler).toHaveLength(1);
  });

  it('toplam bilinmiyorsa kısa sayfa son sayfadır', async () => {
    const s = sahteSunucu(1500, 1000, false);
    expect(await tumSayfalar(s.getir)).toHaveLength(1500);
    expect(s.istekler).toHaveLength(2);
  });

  it('boş liste boş döner; hata yutulmaz', async () => {
    expect(await tumSayfalar(sahteSunucu(0, 1000).getir)).toEqual([]);
    const hata = { message: 'permission denied', code: '42501' };
    await expect(tumSayfalar(async () => ({ data: null, error: hata }))).rejects.toBe(hata);
  });
});
