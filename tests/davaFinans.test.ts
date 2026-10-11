import { describe, expect, it, vi } from 'vitest';
import { sonrakiTaksitNo, tahsilEdilecek } from '@/utils/davaFinans';
import { tekSeferde } from '@/lib/tekSeferde';

/**
 * DAVA DETAYI — FİNANS SEKMESİ (09.10.2026, denetimde bulundu, kodla doğrulandı).
 */

describe('Tahsil Edilecek — yalnız toplamı belli ücrette hesaplanır', () => {
  it('sabit ücret: ücret − tahsil edilen, eksiye düşmez', () => {
    expect(tahsilEdilecek('fixed', 50000, 20000)).toBe(30000);
    expect(tahsilEdilecek('fixed', 50000, 60000)).toBe(0);
    expect(tahsilEdilecek(null, 50000, 0)).toBe(50000); // eski kayıt: tip yok = sabit
    expect(tahsilEdilecek('fixed', null, 0)).toBeNull();
  });

  it('sabit danışmanlık (aylık): AYLIK tutardan tüm tahsilatı düşmek yanlış → hesaplanmaz', () => {
    // Eskiden: aylık 10.000, hiç ödeme yokken "Tahsil Edilecek ₺10.000";
    // üç ay ödendiyse "₺0" — ikisi de anlamsız.
    expect(tahsilEdilecek('retainer', 10000, 0)).toBeNull();
    expect(tahsilEdilecek('retainer', 10000, 30000)).toBeNull();
    expect(tahsilEdilecek('retainer_success', 10000, 0)).toBeNull();
  });

  it('yüzde ve peşin+yüzde: toplam sonuca bağlı → hesaplanmaz (formdan kalan eski tutar kullanılmaz)', () => {
    // Formda tip "sabit"ten "yüzde"ye çevrilince gizli ücret kutusu eski
    // değeriyle kaydediliyor; detay onu toplam ücret sanıyordu.
    expect(tahsilEdilecek('percentage', 50000, 10000)).toBeNull();
    expect(tahsilEdilecek('advance_percentage', 50000, 10000)).toBeNull();
  });
});

describe('Taksit numarası', () => {
  it('ilk taksit 1', () => {
    expect(sonrakiTaksitNo([])).toBe(1);
  });

  it('arada taksit silindiyse numara TEKRARLANMAZ (1,3 varken 3 değil 4)', () => {
    expect(sonrakiTaksitNo([{ seq: 1 }, { seq: 3 }])).toBe(4);
  });
});

describe('Taksit Ekle — çift dokunuş', () => {
  it('istek sürerken ikinci basış yok sayılır (tek taksit oluşur)', async () => {
    const kilit = { current: false };
    const bitir: Array<() => void> = [];
    const ekle = vi.fn(() => new Promise<void>((r) => bitir.push(r)));
    const birinci = tekSeferde(kilit, ekle);
    const ikinci = tekSeferde(kilit, ekle);
    bitir.forEach((b) => b());
    await Promise.all([birinci, ikinci]);
    expect(ekle).toHaveBeenCalledTimes(1);
  });

  it('istek bitince (hata olsa bile) düğme yeniden çalışır', async () => {
    const kilit = { current: false };
    await expect(tekSeferde(kilit, async () => Promise.reject(new Error('ağ')))).rejects.toThrow('ağ');
    const ekle = vi.fn(async () => {});
    await tekSeferde(kilit, ekle);
    expect(ekle).toHaveBeenCalledTimes(1);
  });
});
