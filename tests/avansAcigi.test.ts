import { describe, expect, it } from 'vitest';
import { avansAciklari, type AvansVerisi } from '@/utils/avansAcigi';

/**
 * MASRAF AVANSI UYARISI — KISMİ HATA (09.10.2026 denetimi).
 *
 * BULUNAN KUSUR. Ana ekrandaki "Masraf avansı uyarısı" beş ayrı sorgudan
 * hesaplanıyordu ve hiçbirinin hatasına bakılmıyordu (`adv.data ?? []`).
 * Avans sorgusu düşünce yatırılan avans 0 sayılıyor, masrafı olan HER
 * müvekkil "ek avans istenmeli" diye listeleniyordu; dava sorgusu düşünce
 * dava masrafları kimseye yazılmıyor, gerçek açık gizleniyordu. Doğrusu: bir
 * parça bile eksikse hesap yapılmaz, sorgu hata verir (uyarı kartı çizilmez).
 */
const tamam = <T,>(data: T[]) => ({ data, error: null });
const dustu = { data: null, error: { code: 'PGRST301', message: 'zaman aşımı' } };

const veri: AvansVerisi = {
  musteriler: tamam([
    { id: 'a', full_name: 'A Kişi', company: null },
    { id: 'b', full_name: 'B Kişi', company: 'B Ltd' },
  ]),
  avanslar: tamam([
    { client_id: 'a', amount: 1000 },
    { client_id: 'b', amount: 2000 },
  ]),
  musteriMasraflari: tamam([{ client_id: 'a', amount: 500 }]),
  davalar: tamam([
    { id: 'd1', client_id: 'a' },
    { id: 'd2', client_id: 'b' },
  ]),
  davaMasraflari: tamam([
    { case_id: 'd1', amount: 1000 },
    { case_id: 'd2', amount: 100 },
  ]),
};

describe('masraf avansı açığı', () => {
  it('tam veride açığı doğru hesaplar (A: 1.000 yatırdı, 1.500 harcandı)', () => {
    expect(avansAciklari(veri)).toEqual([{ id: 'a', name: 'A Kişi', deficit: 500 }]);
  });

  it('avans sorgusu düşerse kimseyi açıkta göstermez — hata fırlatır', () => {
    // Eskiden: [{a, 1500}, {b, 100}] — B'nin 2.000 avansı yok sayılıyordu.
    expect(() => avansAciklari({ ...veri, avanslar: dustu })).toThrow();
  });

  it('dava sorgusu düşerse gerçek açığı gizlemez — hata fırlatır', () => {
    // Eskiden: [] — A'nın dava masrafı kimseye yazılmıyor, 500 TL açık kayboluyordu.
    expect(() => avansAciklari({ ...veri, davalar: dustu })).toThrow();
  });

  it.each(['musteriler', 'musteriMasraflari', 'davaMasraflari'] as const)('%s sorgusu düşerse hata fırlatır', (k) => {
    expect(() => avansAciklari({ ...veri, [k]: dustu })).toThrow();
  });

  it('fırlatılan, sorgunun kendi hatasıdır (tablo-yok kontrolü kodunu okuyabilsin)', () => {
    let yakalanan: unknown;
    try {
      avansAciklari({ ...veri, avanslar: dustu });
    } catch (e) {
      yakalanan = e;
    }
    expect(yakalanan).toBe(dustu.error);
  });
});
