import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { masrafAvansiOzeti, tahsilEdilecek, tahsilEdilenToplam } from '@/utils/davaFinans';
import { davaMasrafiDegisti } from '@/lib/masrafOnbellegi';

/**
 * AVANS BAKİYESİ BAYAT KALIYOR VE HATA YUTULUYOR (09.10.2026, denetimde
 * bulundu, kodla doğrulandı).
 *
 *  - Dava detayında masraf eklenip silinince yalnız davanın masraf listesi
 *    tazeleniyordu. Aynı masrafları sayan müvekkil avans bakiyesi
 *    (['client-expenses-total']) ve ana ekrandaki "avans eksiye düştü" uyarısı
 *    (['advance-deficits']) eski toplamla kalıyordu (natifte odak tazelemesi
 *    bağlı değil; ekran yeniden açılmadan çekilmiyordu).
 *  - Masraf listesi YÜKLENEMEDİĞİNDE harcanan ₺0 sayılıyor, "Kalan" avansın
 *    tamamı görünüyordu; ödeme/taksit listesi yüklenemediğinde "Tahsil Edilen
 *    ₺0", "Tahsil Edilecek" ücretin tamamı. Hata hiçbir yerde söylenmiyordu.
 */

describe('masraf eklenince/silinince bayatlayan önbellekler', () => {
  it('müvekkil avans bakiyesi ve ana ekran avans uyarısı da tazelenir', () => {
    const qc = new QueryClient();
    for (const k of [['case-expenses', 'd1'], ['client-expenses-total', 'm1'], ['advance-deficits']]) qc.setQueryData(k, 0);
    davaMasrafiDegisti(qc);
    expect(qc.getQueryState(['case-expenses', 'd1'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['client-expenses-total', 'm1'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['advance-deficits'])?.isInvalidated).toBe(true);
  });
});

describe('yüklenemeyen liste ₺0 sayılmaz', () => {
  it('masraflar yüklenemediyse harcanan ve kalan bilinmiyor (avansın tamamı "kalan" görünmez)', () => {
    expect(masrafAvansiOzeti(10000, undefined)).toEqual({ avans: 10000, harcanan: null, kalan: null });
  });

  it('masraflar geldiyse kalan = avans − harcanan (eksi olabilir)', () => {
    expect(masrafAvansiOzeti(10000, [{ amount: 2500 }, { amount: 500 }])).toEqual({ avans: 10000, harcanan: 3000, kalan: 7000 });
    expect(masrafAvansiOzeti(null, [{ amount: 500 }])).toEqual({ avans: 0, harcanan: 500, kalan: -500 });
  });

  it('ödeme ya da taksit listesi yüklenemediyse tahsil edilen bilinmiyor; tahsil edilecek de', () => {
    expect(tahsilEdilenToplam(undefined, [])).toBeNull();
    expect(tahsilEdilenToplam([], undefined)).toBeNull();
    expect(tahsilEdilecek('fixed', 50000, null)).toBeNull();
  });

  it('ikisi de geldiyse: ödemeler + ödendi işaretli taksitler', () => {
    expect(
      tahsilEdilenToplam([{ amount: 1000 }], [
        { amount: 2000, is_paid: true },
        { amount: 4000, is_paid: false },
      ]),
    ).toBe(3000);
  });
});
