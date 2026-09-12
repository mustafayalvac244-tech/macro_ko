// Sınırlı eşzamanlılık havuzu — sıra, sınır ve hata yalıtımı.
//
// Bu üç davranış hasat için tek tek önemli:
//   · SIRA bozulursa indirilen metin yanlış karara yazılır.
//   · SINIR aşılırsa UYAP'a ölçülmemiş bir hızla yüklenilir (IP yasağı riski).
//   · Bir belge patladığında tur komple düşerse, indirilen diğer belgeler de
//     çöpe gider.
import { describe, it, expect } from 'vitest';
import { havuzda } from '../supabase/functions/_shared/havuz';

const uyu = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('havuzda', () => {
  it('sonuçları giriş sırasında döndürür', async () => {
    const girdi = [40, 5, 30, 1, 20];
    // Uzun süren iş ÖNCE geliyor; sonuç sırası bitiş sırasına kayarsa bu test düşer.
    const s = await havuzda(girdi, 3, async (ms) => {
      await uyu(ms);
      return ms * 2;
    });
    expect(s).toEqual([80, 10, 60, 2, 40]);
  });

  it('aynı anda sınırdan fazla iş çalıştırmaz', async () => {
    let anlik = 0;
    let enYuksek = 0;
    await havuzda(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      anlik++;
      enYuksek = Math.max(enYuksek, anlik);
      await uyu(5);
      anlik--;
      return 1;
    });
    expect(enYuksek).toBe(4);
  });

  it('tek bir işin hatası diğerlerini düşürmez', async () => {
    const s = await havuzda([1, 2, 3, 4], 2, async (x) => {
      if (x === 2) throw new Error('belge indirilemedi');
      return x * 10;
    });
    expect(s).toEqual([10, undefined, 30, 40]);
  });

  it('boş liste için boş döner ve hiç iş çalıştırmaz', async () => {
    let cagri = 0;
    const s = await havuzda([], 4, async () => {
      cagri++;
      return 1;
    });
    expect(s).toEqual([]);
    expect(cagri).toBe(0);
  });

  it('sınır iş sayısından büyükse fazladan işçi açmaz', async () => {
    let anlik = 0;
    let enYuksek = 0;
    await havuzda([1, 2], 10, async () => {
      anlik++;
      enYuksek = Math.max(enYuksek, anlik);
      await uyu(5);
      anlik--;
      return 1;
    });
    expect(enYuksek).toBe(2);
  });

  it('sınır 0 ya da negatifse seri çalışır — sessizce sınırsıza düşmez', async () => {
    for (const sinir of [0, -3, Number.NaN]) {
      let anlik = 0;
      let enYuksek = 0;
      await havuzda([1, 2, 3], sinir, async () => {
        anlik++;
        enYuksek = Math.max(enYuksek, anlik);
        await uyu(2);
        anlik--;
        return 1;
      });
      expect(enYuksek).toBe(1);
    }
  });
});
